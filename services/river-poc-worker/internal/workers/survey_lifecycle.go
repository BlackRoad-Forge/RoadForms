package workers

import (
	"context"
	"log/slog"

	"github.com/riverqueue/river"
)

const (
	QueueName       = "survey_lifecycle"
	SurveyStartKind = "survey.start"
	SurveyEndKind   = "survey.end"
)

type SurveyLifecyclePayload struct {
	SurveyID      string `json:"surveyId"`
	EnvironmentID string `json:"environmentId"`
	ScheduledFor  string `json:"scheduledFor"`
}

type SurveyStartArgs struct {
	SurveyLifecyclePayload
}

func (SurveyStartArgs) Kind() string { return SurveyStartKind }

type SurveyEndArgs struct {
	SurveyLifecyclePayload
}

func (SurveyEndArgs) Kind() string { return SurveyEndKind }

type SurveyStartWorker struct {
	river.WorkerDefaults[SurveyStartArgs]
	logger *slog.Logger
}

type SurveyEndWorker struct {
	river.WorkerDefaults[SurveyEndArgs]
	logger *slog.Logger
}

func NewSurveyStartWorker(logger *slog.Logger) *SurveyStartWorker {
	return &SurveyStartWorker{logger: logger}
}

func NewSurveyEndWorker(logger *slog.Logger) *SurveyEndWorker {
	return &SurveyEndWorker{logger: logger}
}

func Register(workerRegistry *river.Workers, logger *slog.Logger) {
	river.AddWorker(workerRegistry, NewSurveyStartWorker(logger))
	river.AddWorker(workerRegistry, NewSurveyEndWorker(logger))
}

func (w *SurveyStartWorker) Work(ctx context.Context, job *river.Job[SurveyStartArgs]) error {
	logLifecycle(ctx, w.logger, "STARTING SURVEY", SurveyStartKind, job.Args.SurveyLifecyclePayload)
	return nil
}

func (w *SurveyEndWorker) Work(ctx context.Context, job *river.Job[SurveyEndArgs]) error {
	logLifecycle(ctx, w.logger, "ENDING SURVEY", SurveyEndKind, job.Args.SurveyLifecyclePayload)
	return nil
}

func logLifecycle(
	ctx context.Context,
	logger *slog.Logger,
	message string,
	kind string,
	payload SurveyLifecyclePayload,
) {
	logger.InfoContext(
		ctx,
		message,
		slog.String("job_kind", kind),
		slog.String("survey_id", payload.SurveyID),
		slog.String("environment_id", payload.EnvironmentID),
		slog.String("scheduled_for", payload.ScheduledFor),
	)
}
