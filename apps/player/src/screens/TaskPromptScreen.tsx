import { useState } from "react";
import type { Task } from "@familyquest/shared";
import { t } from "../i18n.js";

/** Full-screen takeover when the DM addresses this player directly. */
export function TaskPromptScreen({
  task,
  onAnswer,
}: {
  task: Task;
  onAnswer: (answer: { choiceId?: string; freeText?: string }) => void;
}) {
  const [text, setText] = useState("");

  return (
    <div className="screen center" style={{ gap: 24, justifyContent: "center" }}>
      <div className="bounce" aria-hidden>
        🗣️
      </div>
      <div className="stack center" style={{ gap: 8 }}>
        <h1 className="title">{t("task.title")}</h1>
        <div className="card" style={{ fontSize: 19, lineHeight: 1.5, maxWidth: 360 }}>
          {task.prompt}
        </div>
      </div>

      {task.choices && task.choices.length > 0 ? (
        <div className="stack" style={{ width: "100%", maxWidth: 340 }}>
          {task.choices.map((choice) => (
            <button
              key={choice.id}
              className="btn btn-secondary"
              onClick={() => onAnswer({ choiceId: choice.id })}
            >
              {choice.label}
            </button>
          ))}
        </div>
      ) : (
        <form
          className="stack"
          style={{ width: "100%", maxWidth: 340 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) onAnswer({ freeText: text.trim() });
          }}
        >
          <input
            className="input"
            value={text}
            maxLength={280}
            placeholder={t("play.actionPlaceholder")}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
          <button className="btn" type="submit" disabled={!text.trim()}>
            {t("play.send")} ✨
          </button>
        </form>
      )}
    </div>
  );
}
