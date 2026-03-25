package riverapp

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"

	"github.com/formbricks/formbricks/services/river-poc-worker/internal/config"
	"github.com/formbricks/formbricks/services/river-poc-worker/internal/workers"
)

type App struct {
	client *river.Client[pgx.Tx]
	pool   *pgxpool.Pool
}

func New(ctx context.Context, cfg config.Config, logger *slog.Logger) (*App, error) {
	return newWithOptions(ctx, cfg, logger, false)
}

func newWithOptions(
	ctx context.Context,
	cfg config.Config,
	logger *slog.Logger,
	testOnly bool,
) (*App, error) {
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("create pgx pool: %w", err)
	}

	workerRegistry := river.NewWorkers()
	workers.Register(workerRegistry, logger)

	client, err := river.NewClient(riverpgxv5.New(pool), &river.Config{
		Logger: logger,
		Schema: cfg.RiverSchema,
		Queues: map[string]river.QueueConfig{
			workers.QueueName: {
				MaxWorkers: 2,
			},
		},
		TestOnly: testOnly,
		Workers:  workerRegistry,
	})
	if err != nil {
		pool.Close()
		return nil, fmt.Errorf("create river client: %w", err)
	}

	return &App{
		client: client,
		pool:   pool,
	}, nil
}

func (a *App) Start(ctx context.Context) error {
	if err := a.client.Start(ctx); err != nil {
		return fmt.Errorf("start river client: %w", err)
	}

	return nil
}

func (a *App) Stop(ctx context.Context) error {
	defer a.pool.Close()

	if err := a.client.Stop(ctx); err != nil {
		return fmt.Errorf("stop river client: %w", err)
	}

	return nil
}
