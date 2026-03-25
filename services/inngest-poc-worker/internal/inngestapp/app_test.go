package inngestapp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/inngest/inngestgo"

	"github.com/formbricks/formbricks/services/inngest-poc-worker/internal/config"
	"github.com/formbricks/formbricks/services/inngest-poc-worker/internal/workers"
)

func TestRoutesInvokeSignedFunction(t *testing.T) {
	var logs bytes.Buffer
	logger := slog.New(slog.NewTextHandler(&logs, &slog.HandlerOptions{Level: slog.LevelInfo}))
	signingKey := "signkey-test-0123456789abcdef0123456789abcdef"

	app, err := New(
		config.Config{
			BaseURL:    "http://inngest:8288",
			SigningKey: signingKey,
			Port:       "8287",
		},
		logger,
	)
	if err != nil {
		t.Fatalf("expected app to initialize, got %v", err)
	}

	body, err := json.Marshal(map[string]any{
		"event": workers.SurveyLifecycleScheduledEvent{
			Name: workers.SurveyStartEventName,
			Data: workers.SurveyLifecycleScheduledEventData{
				SurveyID:      "survey_1",
				EnvironmentID: "env_1",
				ScheduledFor:  "2026-04-01T12:00:00.000Z",
			},
		},
		"ctx": map[string]any{
			"fn_id":  "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
			"run_id": "run-id",
		},
	})
	if err != nil {
		t.Fatalf("expected request body to marshal, got %v", err)
	}

	signature, err := inngestgo.Sign(context.Background(), time.Now(), []byte(signingKey), body)
	if err != nil {
		t.Fatalf("expected request to be signed, got %v", err)
	}

	req := httptest.NewRequest(
		http.MethodPost,
		fmt.Sprintf("%s?fnId=%s-%s", ServePath, AppID, workers.SurveyStartFunctionID),
		bytes.NewReader(body),
	)
	req.Header.Set(inngestgo.HeaderKeySignature, signature)
	req.Header.Set(inngestgo.HeaderKeyContentType, "application/json")

	recorder := httptest.NewRecorder()
	app.Routes().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %q", http.StatusOK, recorder.Code, recorder.Body.String())
	}

	output := logs.String()
	if !strings.Contains(output, "STARTING SURVEY") {
		t.Fatalf("expected logs to contain STARTING SURVEY, got %q", output)
	}

	if !strings.Contains(output, "event_kind="+workers.SurveyStartEventName) {
		t.Fatalf("expected logs to contain event kind, got %q", output)
	}
}
