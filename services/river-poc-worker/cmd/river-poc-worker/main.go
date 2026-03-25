package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/formbricks/formbricks/services/river-poc-worker/internal/config"
	"github.com/formbricks/formbricks/services/river-poc-worker/internal/riverapp"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	cfg, err := config.LoadFromEnv()
	if err != nil {
		logger.Error("failed to load configuration", slog.Any("error", err))
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	app, err := riverapp.New(ctx, cfg, logger)
	if err != nil {
		logger.Error("failed to initialize River application", slog.Any("error", err))
		os.Exit(1)
	}

	if err := app.Start(ctx); err != nil {
		logger.Error("failed to start River application", slog.Any("error", err))
		os.Exit(1)
	}

	logger.Info("river-poc-worker started")

	<-ctx.Done()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := app.Stop(shutdownCtx); err != nil {
		logger.Error("failed to stop River application cleanly", slog.Any("error", err))
		os.Exit(1)
	}

	logger.Info("river-poc-worker stopped")
}
