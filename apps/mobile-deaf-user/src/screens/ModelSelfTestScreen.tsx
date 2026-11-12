// ModelSelfTestScreen.tsx — development-only hidden debug screen.
//
// Reach it with the query param: localhost:8081/?dev=1
// In a real dev build: /?dev=1
//
// It loads model_fixtures.json, runs each saved sequence through the
// on-device model, and shows for each:
//   - expected top-5 (from the fixture),
//   - actual top-5 (from the on-device model),
//   - whether top-1 matches,
//   - the largest probability difference,
//   - time per inference,
//   - for a live recording: time from "stop" to result.
//
// It is a development-only debug tool. It is not wired into the normal
// session state machine.

import React from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useSession } from "../context/SessionContext";
import { useHandRecorder } from "../hooks/useHandRecorder";
import {
  recogniseOnDevice,
  loadModelMetadata,
  RecogniserResult,
  type ModelMetadata,
} from "../model/recogniser";

export function ModelSelfTestScreen() {
  const { recording } = useHandRecorder(() => {}, () => {});

  const { recogniseResult, recogniseError, recognitionBackend, isRecognising } =
    useSession();

  // Development flag: show this screen only in development.
  const dev = process.env.EXPO_PUBLIC_DEV === "1";

  const [fixtures, setFixtures] = React.useState<ModelFixture[] | null>(null);
  const [results, setResults] = React.useState<FixtureResult[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Load fixtures and run on-device inference for each saved sequence.
  React.useEffect(() => {
    if (!dev) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const metadata = await loadModelMetadata();
        let fixtureData: ModelFixtures;
        try {
          // @ts-ignore — asset JSON resolution is a native-bundle concern.
          const mod = await import("../assets/model/model_fixtures.json");
          fixtureData = mod.default as ModelFixtures;
        } catch (err) {
          fixtureData = {
            fixtures: [],
            error: "Assets not bundled in this build",
          } as ModelFixtures;
        }

        const fixtureResults = await Promise.all(
          fixtureData.fixtures.map(async (fx: ModelFixture) => {
            const sequence = new Float32Array(fx.sequence);
            const actual = await recogniseOnDevice(sequence, metadata, false);
            let top1Matches = false;
            let largestDiff = 0;
            let expectedTop5: { sign: string; probability: number }[] = [];
            if (fx.expected && fx.expected.length > 0) {
              expectedTop5 = fx.expected;
              if (actual && actual.results.length > 0) {
                top1Matches =
                  actual.results[0]?.sign === fx.expected[0].sign;
                const n = Math.min(
                  actual.results.length,
                  fx.expected.length,
                  5,
                );
                for (let i = 0; i < n; i++) {
                  const d = Math.abs(
                    actual.results[i].probability - fx.expected[i].probability,
                  );
                  if (d > largestDiff) largestDiff = d;
                }
              }
            }
            return {
              name: fx.name,
              expectedTop5: fx.expected ?? null,
              actualTop5: actual?.results ?? [],
              top1Matches,
              largestDiff,
              timingMs: actual?.timingMs ?? 0,
            };
          }),
        );
        if (!cancelled) setResults(fixtureResults);
        if (!cancelled) setFixtures(fixtureData.fixtures);
      } catch (err) {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dev]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView>
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: "bold" }}>
            Model Self-Test
          </Text>
          <Text style={{ fontSize: 12, color: "gray" }}>
            Development-only debug screen. Reach with ?dev=1
          </Text>

          {loading && <ActivityIndicator />}

          {!loading && !fixtures && (
            <Text>No fixtures loaded (assets not bundled in this build).</Text>
          )}

          {fixtures && results.length > 0 && (
            <>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "bold",
                  marginTop: 12,
                }}
              >
                Saved-landmark self-tests ({results.length})
              </Text>
              {results.map((r) => (
                <View
                  key={r.name}
                  style={{
                    backgroundColor: "#f5f5f5",
                    padding: 12,
                    borderRadius: 8,
                    marginVertical: 6,
                  }}
                >
                  <Text style={{ fontWeight: "bold" }}>{r.name}</Text>
                  <Text>
                    Top-1 match: {r.top1Matches ? "YES" : "NO"}
                  </Text>
                  <Text>
                    Largest prob diff: {r.largestDiff.toFixed(4)}
                  </Text>
                  <Text>Timing: {r.timingMs.toFixed(2)} ms</Text>
                  <Text style={{ fontWeight: "bold" }}>Expected top-5:</Text>
                  {r.expectedTop5?.map((e, i) => (
                    <Text key={i}>
                      {" "}
                      [{i}] {e.sign}: {e.probability.toFixed(3)}
                    </Text>
                  ))}
                  <Text style={{ fontWeight: "bold", marginTop: 4 }}>
                    Actual top-5:
                  </Text>
                  {r.actualTop5.map((a, i) => (
                    <Text key={i}>
                      {" "}
                      [{i}] {a.sign}: {a.probability.toFixed(3)}
                    </Text>
                  ))}
                </View>
              ))}
            </>
          )}

          {recognitionBackend === "model" && recogniseResult && (
            <View
              style={{
                backgroundColor: "#e8f5e9",
                padding: 12,
                borderRadius: 8,
                marginTop: 12,
              }}
            >
              <Text style={{ fontWeight: "bold" }}>
                Live recording — top-1: {recogniseResult.top1}
              </Text>
              <Text>
                Confidence:{" "}
                {recogniseResult.results[0]?.probability.toFixed(3)}
              </Text>
            </View>
          )}

          {recogniseError && <Text style={{ color: "red" }}>{recogniseError}</Text>}
        </View>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Types for fixtures
// ---------------------------------------------------------------------------

export interface ModelFixture {
  name: string;
  sequence: number[]; // 60 * 126 = 7560 floats
  expected?: { sign: string; probability: number }[];
}

export interface ModelFixtures {
  fixtures: ModelFixture[];
  error?: string;
}

export interface FixtureResult {
  name: string;
  expectedTop5: { sign: string; probability: number }[] | null;
  actualTop5: { sign: string; probability: number }[];
  top1Matches: boolean;
  largestDiff: number;
  timingMs: number;
}
