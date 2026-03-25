package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/formbricks/formbricks/services/inngest-poc-worker/internal/config"
	"github.com/formbricks/formbricks/services/inngest-poc-worker/internal/inngestapp"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	cfg, err := config.LoadFromEnv()
	if err != nil {
		logger.Error("failed to load configuration", slog.Any("error", err))
		os.Exit(1)
	}

	app, err := inngestapp.New(cfg, logger)
	if err != nil {
		logger.Error("failed to initialize Inngest application", slog.Any("error", err))
		os.Exit(1)
	}

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           app.Routes(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		<-ctx.Done()

		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := server.Shutdown(shutdownCtx); err != nil {
			logger.Error("failed to shut down server cleanly", slog.Any("error", err))
		}
	}()

	logger.Info("inngest-poc-worker started", slog.String("addr", server.Addr))

	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		logger.Error("worker server stopped unexpectedly", slog.Any("error", err))
		os.Exit(1)
	}

	logger.Info("inngest-poc-worker stopped")
}
