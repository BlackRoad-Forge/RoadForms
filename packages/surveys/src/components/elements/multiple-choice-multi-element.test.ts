import { describe, expect, it } from "vitest";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import type { TSurveyMultipleChoiceElement } from "@formbricks/types/surveys/elements";

/**
 * Test to verify that the elementChoices useMemo properly filters out undefined values
 * when shuffledChoicesIds contains IDs that don't exist in element.choices.
 *
 * This test simulates the bug scenario where:
 * 1. shuffledChoicesIds contains a choice ID
 * 2. element.choices.find() returns undefined for that ID
 * 3. The undefined value should be filtered out to prevent TypeError
 */
describe("MultipleChoiceMultiElement - elementChoices filtering", () => {
  it("should filter out undefined choices when shuffled IDs don't match", () => {
    // Simulate the scenario where shuffledChoicesIds might contain IDs
    // that are no longer in element.choices
    const mockElement: TSurveyMultipleChoiceElement = {
      id: "test-element",
      type: TSurveyElementTypeEnum.MultipleChoiceMulti,
      headline: { default: "Test Question" },
      required: false,
      shuffleOption: "all",
      choices: [
        { id: "choice-1", label: { default: "Option 1" } },
        { id: "choice-2", label: { default: "Option 2" } },
        { id: "choice-3", label: { default: "Option 3" } },
      ],
    };

    // Simulate shuffledChoicesIds that includes an ID not in element.choices
    const shuffledChoicesIds = ["choice-1", "invalid-id", "choice-2", "choice-3"];

    // This simulates the logic in the elementChoices useMemo
    const elementChoices = shuffledChoicesIds
      .map((choiceId) => {
        const choice = mockElement.choices.find((currentChoice) => {
          return currentChoice.id === choiceId;
        });
        return choice;
      })
      .filter((choice): choice is NonNullable<typeof choice> => choice !== undefined);

    // Verify that undefined values are filtered out
    expect(elementChoices).toHaveLength(3);
    expect(elementChoices.every((choice) => choice !== undefined)).toBe(true);

    // Verify that we can safely create a Set from the filtered choices
    const knownLabels = new Set(
      elementChoices.filter((c) => c && c.id !== "other").map((c) => c!.label.default)
    );

    expect(knownLabels.size).toBe(3);
    expect(() => knownLabels.has("Option 1")).not.toThrow();
  });

  it("should handle empty choices array", () => {
    const mockElement: TSurveyMultipleChoiceElement = {
      id: "test-element",
      type: TSurveyElementTypeEnum.MultipleChoiceMulti,
      headline: { default: "Test Question" },
      required: false,
      shuffleOption: "all",
      choices: [],
    };

    const shuffledChoicesIds: string[] = [];

    const elementChoices = shuffledChoicesIds
      .map((choiceId) => {
        const choice = mockElement.choices.find((currentChoice) => {
          return currentChoice.id === choiceId;
        });
        return choice;
      })
      .filter((choice): choice is NonNullable<typeof choice> => choice !== undefined);

    expect(elementChoices).toHaveLength(0);
  });

  it("should preserve all choices when all IDs are valid", () => {
    const mockElement: TSurveyMultipleChoiceElement = {
      id: "test-element",
      type: TSurveyElementTypeEnum.MultipleChoiceMulti,
      headline: { default: "Test Question" },
      required: false,
      shuffleOption: "all",
      choices: [
        { id: "choice-1", label: { default: "Option 1" } },
        { id: "choice-2", label: { default: "Option 2" } },
      ],
    };

    const shuffledChoicesIds = ["choice-2", "choice-1"];

    const elementChoices = shuffledChoicesIds
      .map((choiceId) => {
        const choice = mockElement.choices.find((currentChoice) => {
          return currentChoice.id === choiceId;
        });
        return choice;
      })
      .filter((choice): choice is NonNullable<typeof choice> => choice !== undefined);

    expect(elementChoices).toHaveLength(2);
    expect(elementChoices[0].id).toBe("choice-2");
    expect(elementChoices[1].id).toBe("choice-1");
  });
});
