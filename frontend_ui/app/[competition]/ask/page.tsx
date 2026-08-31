"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import axios from "axios";
import { Sparkles, Send, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { getCompetition } from "../../lib/competitions";
import { apiUrl } from "../../lib/api";
import Reveal from "../../components/Reveal";

type ChatTurn = {
  question: string;
  answer?: string;
  toolCalls?: { tool: string; input: Record<string, unknown> }[];
  refused?: boolean;
  error?: string;
};

export default function AskPage() {
  const params = useParams<{ competition: string }>();
  const code = params.competition?.toUpperCase() || "";
  const meta = getCompetition(code);

  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [loading, setLoading] = useState(false);

  const suggestions = meta
    ? meta.kind === "cup"
      ? [
          `Who is most likely to win the ${meta.name}?`,
          `How far is Barcelona projected to go in the ${meta.name}?`,
        ]
      : [
          `Who is favoured to win the ${meta.name} this season?`,
          `What's the title race looking like in the ${meta.name}?`,
        ]
    : [];

  const ask = async (question: string) => {
    if (!question.trim() || loading) return;
    setLoading(true);
    setTurns((prev) => [...prev, { question }]);
    setInput("");

    try {
      const res = await axios.post(`${apiUrl()}/ai/ask`, { question });
      const data = res.data;
      setTurns((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          question,
          answer: data.answer,
          toolCalls: data.tool_calls,
          refused: data.refused,
          error: data.error,
        };
        return next;
      });
    } catch (e: any) {
      setTurns((prev) => {
        const next = [...prev];
        next[next.length - 1] = { question, error: e.response?.data?.detail || "Something went wrong." };
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  if (!meta) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Ask the AI about {meta.name}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Gemini answers using the same tables, title-race simulations, and match model you see
            elsewhere on this site — it calls tools to look numbers up rather than inventing them,
            and says so when it doesn't have data for something.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {turns.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="text-xs rounded-full border border-border px-3 py-1.5 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-5">
            {turns.map((turn, i) => (
              <Reveal key={i} trigger="mount" y={16} stagger={0.15} className="space-y-2">
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-4 py-2 text-sm">
                    {turn.question}
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-secondary px-4 py-3 text-sm space-y-2">
                    {turn.answer === undefined && !turn.error && (
                      <span className="text-muted-foreground">Thinking...</span>
                    )}
                    {turn.answer && <p className="whitespace-pre-wrap">{turn.answer}</p>}
                    {turn.error && <p className="text-destructive">{turn.error}</p>}
                    {turn.toolCalls && turn.toolCalls.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/60">
                        {turn.toolCalls.map((tc, j) => (
                          <span
                            key={j}
                            className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground bg-background/60 rounded-full px-2 py-0.5"
                          >
                            <Wrench className="h-3 w-3" />
                            {tc.tool}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex items-center gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask about ${meta.name}...`}
              className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border focus:ring-2 focus:ring-primary text-sm"
              disabled={loading}
            />
            <Button type="submit" disabled={loading || !input.trim()} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
