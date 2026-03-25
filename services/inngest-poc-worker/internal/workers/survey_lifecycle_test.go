package workers

import (
	"bytes"
	"context"
	"log/slog"
	"strings"
	"testing"

	"github.com/inngest/inngestgo"
)

func TestRegisterAddsCancellationRules(t *testing.T) {
	client, err := inngestgo.NewClient(inngestgo.ClientOpts{
		AppID: "test-app",
		Dev:   inngestgo.BoolPtr(true),
	})
	if err != nil {
		t.Fatalf("expected client to initialize, got %v", err)
	}

	functions, err := Register(client, slog.New(slog.NewTextHandler(&bytes.Buffer{}, nil)))
	if err != nil {
		t.Fatalf("expected functions to register, got %v", err)
	}

	if len(functions) != 2 {
		t.Fatalf("expected 2 functions, got %d", len(functions))
	}

	startCancel := functions[0].Config().Cancel
	if len(startCancel) != 1 || startCancel[0].Event != SurveyStartCancelledEvent {
		t.Fatalf("expected survey start cancellation config, got %#v", startCancel)
	}

	endCancel := functions[1].Config().Cancel
	if len(endCancel) != 1 || endCancel[0].Event != SurveyEndCancelledEvent {
		t.Fatalf("expected survey end cancellation config, got %#v", endCancel)
	}
}

func TestSurveyLifecycleHandlersLogStructuredEvents(t *testing.T) {
	testCases := []struct {
		name            string
		handler         inngestgo.SDKFunction[SurveyLifecycleScheduledEventData]
		message         string
		expectedKind    string
		expectedPayload SurveyLifecycleScheduledEventData
	}{
		{
			name:         "start handler logs survey start",
			handler:      NewSurveyStartHandler(slog.New(slog.NewTextHandler(&bytes.Buffer{}, nil))),
			message:      "STARTING SURVEY",
			expectedKind: SurveyStartEventName,
			expectedPayload: SurveyLifecycleScheduledEventData{
				SurveyID:      "survey_start_1",
				EnvironmentID: "env_1",
				ScheduledFor:  "2026-04-01T12:00:00.000Z",
			},
		},
		{
			name:         "end handler logs survey end",
			handler:      NewSurveyEndHandler(slog.New(slog.NewTextHandler(&bytes.Buffer{}, nil))),
			message:      "ENDING SURVEY",
			expectedKind: SurveyEndEventName,
			expectedPayload: SurveyLifecycleScheduledEventData{
				SurveyID:      "survey_end_1",
				EnvironmentID: "env_2",
				ScheduledFor:  "2026-04-02T12:00:00.000Z",
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			var logs bytes.Buffer
			logger := slog.New(slog.NewTextHandler(&logs, &slog.HandlerOptions{Level: slog.LevelInfo}))

			handler := NewSurveyStartHandler(logger)
			if testCase.expectedKind == SurveyEndEventName {
				handler = NewSurveyEndHandler(logger)
			}

			if _, err := handler(
				context.Background(),
				inngestgo.Input[SurveyLifecycleScheduledEventData]{
					Event: SurveyLifecycleScheduledEvent{
						Name: testCase.expectedKind,
						Data: testCase.expectedPayload,
					},
				},
			); err != nil {
				t.Fatalf("expected no error, got %v", err)
			}

			output := logs.String()
			if !strings.Contains(output, testCase.message) {
				t.Fatalf("expected log output to contain %q, got %q", testCase.message, output)
			}

			if !strings.Contains(output, "event_kind="+testCase.expectedKind) {
				t.Fatalf("expected log output to contain kind %q, got %q", testCase.expectedKind, output)
			}

			if !strings.Contains(output, "survey_id="+testCase.expectedPayload.SurveyID) {
				t.Fatalf("expected log output to contain survey_id, got %q", output)
			}

			if !strings.Contains(output, "environment_id="+testCase.expectedPayload.EnvironmentID) {
				t.Fatalf("expected log output to contain environment_id, got %q", output)
			}

			if !strings.Contains(output, "scheduled_for="+testCase.expectedPayload.ScheduledFor) {
				t.Fatalf("expected log output to contain scheduled_for, got %q", output)
			}
		})
	}
}
