import "server-only";

export const RIVER_SCHEMA = "river";
export const RIVER_SURVEY_LIFECYCLE_QUEUE = "survey_lifecycle";
export const RIVER_SURVEY_START_KIND = "survey.start";
export const RIVER_SURVEY_END_KIND = "survey.end";
export const RIVER_SURVEY_LIFECYCLE_MAX_ATTEMPTS = 3;
export const RIVER_INSERT_NOTIFICATION_CHANNEL = "river_insert";

export const RIVER_PENDING_JOB_STATES = ["available", "scheduled", "retryable"] as const;
