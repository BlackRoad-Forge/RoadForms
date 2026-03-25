package workers

import (
	"bytes"
	"context"
	"log/slog"
	"reflect"
	"strings"
	"testing"

	"github.com/riverqueue/river"
)

func TestRegister(t *testing.T) {
	workerRegistry := river.NewWorkers()

	Register(workerRegistry, slog.New(slog.NewTextHandler(&bytes.Buffer{}, nil)))

	workersMap := reflect.ValueOf(workerRegistry).Elem().FieldByName("workersMap")
	if !workersMap.IsValid() {
		t.Fatal("expected workers registry to expose a workersMap field")
	}

	if !workersMap.MapIndex(reflect.ValueOf(SurveyStartKind)).IsValid() {
		t.Fatalf("expected %q worker to be registered", SurveyStartKind)
	}

	if !workersMap.MapIndex(reflect.ValueOf(SurveyEndKind)).IsValid() {
		t.Fatalf("expected %q worker to be registered", SurveyEndKind)
	}
}

func TestSurveyLifecycleWorkers(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name            string
		work            func(context.Context, *slog.Logger) error
		expectedMessage string
		expectedKind    string
	}{
		{
			name: "start worker logs structured survey start event",
			work: func(ctx context.Context, logger *slog.Logger) error {
				return NewSurveyStartWorker(logger).Work(ctx, &river.Job[SurveyStartArgs]{
					Args: SurveyStartArgs{
						SurveyLifecyclePayload: SurveyLifecyclePayload{
							SurveyID:      "survey_start_1",
							EnvironmentID: "env_1",
							ScheduledFor:  "2026-04-01T12:00:00.000Z",
						},
					},
				})
			},
			expectedMessage: "STARTING SURVEY",
			expectedKind:    SurveyStartKind,
		},
		{
			name: "end worker logs structured survey end event",
			work: func(ctx context.Context, logger *slog.Logger) error {
				return NewSurveyEndWorker(logger).Work(ctx, &river.Job[SurveyEndArgs]{
					Args: SurveyEndArgs{
						SurveyLifecyclePayload: SurveyLifecyclePayload{
							SurveyID:      "survey_end_1",
							EnvironmentID: "env_2",
							ScheduledFor:  "2026-04-02T12:00:00.000Z",
						},
					},
				})
			},
			expectedMessage: "ENDING SURVEY",
			expectedKind:    SurveyEndKind,
		},
	}

	for _, tt := range testCases {
		t.Run(tt.name, func(t *testing.T) {
			var logs bytes.Buffer
			logger := slog.New(slog.NewTextHandler(&logs, &slog.HandlerOptions{Level: slog.LevelInfo}))

			if err := tt.work(context.Background(), logger); err != nil {
				t.Fatalf("expected no error, got %v", err)
			}

			output := logs.String()
			if !strings.Contains(output, tt.expectedMessage) {
				t.Fatalf("expected log output to contain %q, got %q", tt.expectedMessage, output)
			}

			if !strings.Contains(output, "job_kind="+tt.expectedKind) {
				t.Fatalf("expected log output to contain kind %q, got %q", tt.expectedKind, output)
			}

			if !strings.Contains(output, "survey_id=") {
				t.Fatalf("expected log output to contain survey_id, got %q", output)
			}

			if !strings.Contains(output, "environment_id=") {
				t.Fatalf("expected log output to contain environment_id, got %q", output)
			}

			if !strings.Contains(output, "scheduled_for=") {
				t.Fatalf("expected log output to contain scheduled_for, got %q", output)
			}
		})
	}
}
