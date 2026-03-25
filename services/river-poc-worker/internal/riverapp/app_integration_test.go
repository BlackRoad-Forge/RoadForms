package riverapp

import (
	"bytes"
	"context"
	"fmt"
	"log/slog"
	"net"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
	"github.com/riverqueue/river/rivermigrate"

	"github.com/formbricks/formbricks/services/river-poc-worker/internal/config"
	"github.com/formbricks/formbricks/services/river-poc-worker/internal/workers"
)

func TestAppProcessesSurveyLifecycleJobsFromSQL(t *testing.T) {
	cfg, err := config.LoadFromEnv()
	if err != nil {
		t.Skip("DATABASE_URL is required for integration tests")
	}
	if !canReachPostgres(t, cfg.DatabaseURL) {
		t.Skip("Postgres is not reachable for integration tests")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		t.Fatalf("create pgx pool: %v", err)
	}
	defer pool.Close()

	schema := fmt.Sprintf("river_poc_test_%d", time.Now().UnixNano())
	if _, err := pool.Exec(ctx, fmt.Sprintf(`CREATE SCHEMA "%s"`, schema)); err != nil {
		t.Fatalf("create schema: %v", err)
	}
	t.Cleanup(func() {
		dropCtx, dropCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer dropCancel()
		_, _ = pool.Exec(dropCtx, fmt.Sprintf(`DROP SCHEMA IF EXISTS "%s" CASCADE`, schema))
	})

	migrator, err := rivermigrate.New(riverpgxv5.New(pool), &rivermigrate.Config{Schema: schema})
	if err != nil {
		t.Fatalf("create migrator: %v", err)
	}

	if _, err := migrator.Migrate(ctx, rivermigrate.DirectionUp, nil); err != nil {
		t.Fatalf("migrate river schema: %v", err)
	}

	var logs bytes.Buffer
	logger := slog.New(slog.NewTextHandler(&logs, &slog.HandlerOptions{Level: slog.LevelInfo}))

	app, err := newWithOptions(ctx, config.Config{
		DatabaseURL: cfg.DatabaseURL,
		RiverSchema: schema,
	}, logger, true)
	if err != nil {
		t.Fatalf("create app: %v", err)
	}
	defer func() {
		stopCtx, stopCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer stopCancel()
		_ = app.Stop(stopCtx)
	}()

	if err := app.Start(ctx); err != nil {
		t.Fatalf("start app: %v", err)
	}

	payload := `{"surveyId":"survey_1","environmentId":"env_1","scheduledFor":"2026-04-01T12:00:00.000Z"}`
	insertQuery := fmt.Sprintf(`
		INSERT INTO "%s"."river_job" (args, kind, max_attempts, queue)
		VALUES ($1::jsonb, $2, $3, $4)
	`, schema)
	if _, err := pool.Exec(ctx, insertQuery, payload, workers.SurveyStartKind, 3, workers.QueueName); err != nil {
		t.Fatalf("insert job: %v", err)
	}

	if _, err := pool.Exec(ctx, `SELECT pg_notify('river_insert', $1)`, `{"queue":"survey_lifecycle"}`); err != nil {
		t.Fatalf("notify river queue: %v", err)
	}

	deadline := time.Now().Add(10 * time.Second)
	for {
		output := logs.String()
		if strings.Contains(output, "STARTING SURVEY") {
			if !strings.Contains(output, "job_kind="+workers.SurveyStartKind) {
				t.Fatalf("expected log output to contain %q, got %q", workers.SurveyStartKind, output)
			}
			if !strings.Contains(output, "survey_id=survey_1") {
				t.Fatalf("expected log output to contain survey_id, got %q", output)
			}
			if !strings.Contains(output, "environment_id=env_1") {
				t.Fatalf("expected log output to contain environment_id, got %q", output)
			}
			if !strings.Contains(output, "scheduled_for=2026-04-01T12:00:00.000Z") {
				t.Fatalf("expected log output to contain scheduled_for, got %q", output)
			}
			return
		}

		if time.Now().After(deadline) {
			t.Fatalf("timed out waiting for lifecycle job to be processed; logs=%q", output)
		}

		time.Sleep(100 * time.Millisecond)
	}
}

func canReachPostgres(t *testing.T, databaseURL string) bool {
	t.Helper()

	parsedURL, err := url.Parse(databaseURL)
	if err != nil {
		return false
	}

	port := parsedURL.Port()
	if port == "" {
		port = "5432"
	}

	conn, err := net.DialTimeout("tcp", net.JoinHostPort(parsedURL.Hostname(), port), 500*time.Millisecond)
	if err != nil {
		return false
	}
	defer conn.Close()

	return true
}
