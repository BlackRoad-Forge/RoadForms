package workers

import (
	"context"
	"log/slog"

	"github.com/inngest/inngestgo"
)

const (
	SurveyStartFunctionID       = "survey-start"
	SurveyEndFunctionID         = "survey-end"
	SurveyStartEventName        = "survey.start"
	SurveyEndEventName          = "survey.end"
	SurveyStartCancelledEvent   = "survey.start.cancelled"
	SurveyEndCancelledEvent     = "survey.end.cancelled"
)

type SurveyLifecycleScheduledEventData struct {
	SurveyID      string `json:"surveyId"`
	EnvironmentID string `json:"environmentId"`
	ScheduledFor  string `json:"scheduledFor"`
}

type SurveyLifecycleScheduledEvent = inngestgo.GenericEvent[SurveyLifecycleScheduledEventData]

func Register(client inngestgo.Client, logger *slog.Logger) ([]inngestgo.ServableFunction, error) {
	startFunction, err := inngestgo.CreateFunction(
		client,
		inngestgo.FunctionOpts{
			ID: SurveyStartFunctionID,
			Cancel: []inngestgo.ConfigCancel{
				{
					Event: SurveyStartCancelledEvent,
					If: inngestgo.StrPtr(
						"event.data.surveyId == async.data.surveyId && event.data.environmentId == async.data.environmentId",
					),
				},
			},
		},
		inngestgo.EventTrigger(SurveyStartEventName, nil),
		NewSurveyStartHandler(logger),
	)
	if err != nil {
		return nil, err
	}

	endFunction, err := inngestgo.CreateFunction(
		client,
		inngestgo.FunctionOpts{
			ID: SurveyEndFunctionID,
			Cancel: []inngestgo.ConfigCancel{
				{
					Event: SurveyEndCancelledEvent,
					If: inngestgo.StrPtr(
						"event.data.surveyId == async.data.surveyId && event.data.environmentId == async.data.environmentId",
					),
				},
			},
		},
		inngestgo.EventTrigger(SurveyEndEventName, nil),
		NewSurveyEndHandler(logger),
	)
	if err != nil {
		return nil, err
	}

	return []inngestgo.ServableFunction{startFunction, endFunction}, nil
}

func NewSurveyStartHandler(logger *slog.Logger) inngestgo.SDKFunction[SurveyLifecycleScheduledEventData] {
	return func(ctx context.Context, input inngestgo.Input[SurveyLifecycleScheduledEventData]) (any, error) {
		logLifecycle(ctx, logger, "STARTING SURVEY", SurveyStartEventName, input.Event.Data)
		return nil, nil
	}
}

func NewSurveyEndHandler(logger *slog.Logger) inngestgo.SDKFunction[SurveyLifecycleScheduledEventData] {
	return func(ctx context.Context, input inngestgo.Input[SurveyLifecycleScheduledEventData]) (any, error) {
		logLifecycle(ctx, logger, "ENDING SURVEY", SurveyEndEventName, input.Event.Data)
		return nil, nil
	}
}

func logLifecycle(
	ctx context.Context,
	logger *slog.Logger,
	message string,
	eventKind string,
	payload SurveyLifecycleScheduledEventData,
) {
	logger.InfoContext(
		ctx,
		message,
		slog.String("event_kind", eventKind),
		slog.String("survey_id", payload.SurveyID),
		slog.String("environment_id", payload.EnvironmentID),
		slog.String("scheduled_for", payload.ScheduledFor),
	)
}
