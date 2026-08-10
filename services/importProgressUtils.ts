/** Yield so React can paint spinner frames between replay chunks. */
export function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

export const REPLAY_CHUNK_SIZE = 3;
