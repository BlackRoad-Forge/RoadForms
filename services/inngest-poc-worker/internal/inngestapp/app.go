package inngestapp

import (
	"fmt"
	"log/slog"
	"net/http"

	"github.com/inngest/inngestgo"

	"github.com/formbricks/formbricks/services/inngest-poc-worker/internal/config"
	"github.com/formbricks/formbricks/services/inngest-poc-worker/internal/workers"
)

const (
	AppID     = "formbricks-inngest-poc-worker"
	ServePath = "/api/inngest"
)

type App struct {
	client inngestgo.Client
	logger *slog.Logger
}

func New(cfg config.Config, logger *slog.Logger) (*App, error) {
	client, err := inngestgo.NewClient(inngestgo.ClientOpts{
		AppID:           AppID,
		APIBaseURL:      inngestgo.StrPtr(cfg.BaseURL),
		EventAPIBaseURL: inngestgo.StrPtr(cfg.BaseURL),
		RegisterURL:     inngestgo.StrPtr(cfg.RegisterURL()),
		SigningKey:      inngestgo.StrPtr(cfg.SigningKey),
		Logger:          logger,
		Dev:             inngestgo.BoolPtr(false),
	})
	if err != nil {
		return nil, fmt.Errorf("create inngest client: %w", err)
	}

	if _, err := workers.Register(client, logger); err != nil {
		return nil, fmt.Errorf("register survey lifecycle functions: %w", err)
	}

	return &App{
		client: client,
		logger: logger,
	}, nil
}

func (a *App) Handler() http.Handler {
	return a.client.ServeWithOpts(inngestgo.ServeOpts{
		Path: inngestgo.StrPtr(ServePath),
	})
}

func (a *App) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.Handle(ServePath, a.Handler())
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	return mux
}
