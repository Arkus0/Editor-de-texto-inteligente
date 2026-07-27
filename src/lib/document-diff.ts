export type DiffSegmentType = "equal" | "insert" | "delete"

export interface DiffSegment {
  type: DiffSegmentType
  text: string
}

export interface DocumentTextDiff {
  segments: DiffSegment[]
  addedWords: number
  removedWords: number
  unchangedWords: number
  similarity: number
  changeGroups: number
  granularity: "word" | "line" | "coarse"
}

interface SequenceChange<T> {
  type: DiffSegmentType
  value: T
}

const WORD_TOKEN_PATTERN =
  /\s+|[\p{L}\p{N}\p{M}]+(?:['’][\p{L}\p{N}\p{M}]+)*|[^\s]/gu

function wordTokens(text: string) {
  return text.match(WORD_TOKEN_PATTERN) ?? []
}

function lineTokens(text: string) {
  return text.match(/[^\n]*(?:\n|$)/g)?.filter(Boolean) ?? []
}

function equivalentWordToken(left: string, right: string) {
  if (/^\s+$/u.test(left) && /^\s+$/u.test(right)) return true
  return left === right
}

function backtrack<T>(
  trace: Array<Map<number, number>>,
  current: T[],
  incoming: T[],
  distance: number
) {
  let x = current.length
  let y = incoming.length
  const changes: Array<SequenceChange<T>> = []

  for (let depth = distance; depth >= 0; depth -= 1) {
    const frontier = trace[depth]
    const diagonal = x - y
    const previousDiagonal =
      diagonal === -depth ||
      (diagonal !== depth &&
        (frontier.get(diagonal - 1) ?? Number.NEGATIVE_INFINITY) <
          (frontier.get(diagonal + 1) ?? Number.NEGATIVE_INFINITY))
        ? diagonal + 1
        : diagonal - 1
    const previousX = frontier.get(previousDiagonal) ?? 0
    const previousY = previousX - previousDiagonal

    while (x > previousX && y > previousY) {
      changes.push({ type: "equal", value: current[x - 1] })
      x -= 1
      y -= 1
    }
    if (depth === 0) break
    if (x === previousX) {
      changes.push({ type: "insert", value: incoming[y - 1] })
      y -= 1
    } else {
      changes.push({ type: "delete", value: current[x - 1] })
      x -= 1
    }
  }

  return changes.reverse()
}

function myersDiff<T>(
  current: T[],
  incoming: T[],
  equal: (left: T, right: T) => boolean,
  maximumDistance: number
): Array<SequenceChange<T>> | null {
  const maximum = current.length + incoming.length
  const frontier = new Map<number, number>([[1, 0]])
  const trace: Array<Map<number, number>> = []

  for (
    let distance = 0;
    distance <= maximum && distance <= maximumDistance;
    distance += 1
  ) {
    trace.push(new Map(frontier))
    for (
      let diagonal = -distance;
      diagonal <= distance;
      diagonal += 2
    ) {
      const moveDown =
        diagonal === -distance ||
        (diagonal !== distance &&
          (frontier.get(diagonal - 1) ?? Number.NEGATIVE_INFINITY) <
            (frontier.get(diagonal + 1) ?? Number.NEGATIVE_INFINITY))
      let x = moveDown
        ? (frontier.get(diagonal + 1) ?? 0)
        : (frontier.get(diagonal - 1) ?? 0) + 1
      let y = x - diagonal
      while (
        x < current.length &&
        y < incoming.length &&
        equal(current[x], incoming[y])
      ) {
        x += 1
        y += 1
      }
      frontier.set(diagonal, x)
      if (x >= current.length && y >= incoming.length) {
        return backtrack(trace, current, incoming, distance)
      }
    }
  }
  return null
}

function trimAndDiff<T>(
  current: T[],
  incoming: T[],
  equal: (left: T, right: T) => boolean,
  maximumDistance: number
) {
  let prefixLength = 0
  while (
    prefixLength < current.length &&
    prefixLength < incoming.length &&
    equal(current[prefixLength], incoming[prefixLength])
  ) {
    prefixLength += 1
  }

  let suffixLength = 0
  while (
    suffixLength < current.length - prefixLength &&
    suffixLength < incoming.length - prefixLength &&
    equal(
      current[current.length - 1 - suffixLength],
      incoming[incoming.length - 1 - suffixLength]
    )
  ) {
    suffixLength += 1
  }

  const prefix = current
    .slice(0, prefixLength)
    .map((value) => ({ type: "equal" as const, value }))
  const currentMiddle = current.slice(
    prefixLength,
    current.length - suffixLength
  )
  const incomingMiddle = incoming.slice(
    prefixLength,
    incoming.length - suffixLength
  )
  const middle = myersDiff(
    currentMiddle,
    incomingMiddle,
    equal,
    maximumDistance
  )
  if (!middle) return null
  const suffix = current
    .slice(current.length - suffixLength)
    .map((value) => ({ type: "equal" as const, value }))
  return [...prefix, ...middle, ...suffix]
}

function coalesce(changes: Array<SequenceChange<string>>) {
  const segments: DiffSegment[] = []
  for (const change of changes) {
    const previous = segments[segments.length - 1]
    if (previous?.type === change.type) {
      previous.text += change.value
    } else {
      segments.push({ type: change.type, text: change.value })
    }
  }
  return segments
}

function countWords(text: string) {
  return text.match(/[\p{L}\p{N}\p{M}]+(?:['’][\p{L}\p{N}\p{M}]+)*/gu)
    ?.length ?? 0
}

export function compareDocumentText(
  currentText: string,
  incomingText: string
): DocumentTextDiff {
  const currentWordTokens = wordTokens(currentText)
  const incomingWordTokens = wordTokens(incomingText)
  let granularity: DocumentTextDiff["granularity"] = "word"
  let changes =
    currentWordTokens.length + incomingWordTokens.length <= 12_000
      ? trimAndDiff(
          currentWordTokens,
          incomingWordTokens,
          equivalentWordToken,
          2_000
        )
      : null

  if (!changes) {
    granularity = "line"
    const currentLines = lineTokens(currentText)
    const incomingLines = lineTokens(incomingText)
    changes = trimAndDiff(
      currentLines,
      incomingLines,
      (left, right) => left === right,
      1_000
    )
  }

  if (!changes) {
    granularity = "coarse"
    changes = [
      ...(currentText
        ? [{ type: "delete" as const, value: currentText }]
        : []),
      ...(incomingText
        ? [{ type: "insert" as const, value: incomingText }]
        : []),
    ]
  }

  const segments = coalesce(changes)
  const addedWords = segments
    .filter((segment) => segment.type === "insert")
    .reduce((total, segment) => total + countWords(segment.text), 0)
  const removedWords = segments
    .filter((segment) => segment.type === "delete")
    .reduce((total, segment) => total + countWords(segment.text), 0)
  const unchangedWords = segments
    .filter((segment) => segment.type === "equal")
    .reduce((total, segment) => total + countWords(segment.text), 0)
  const currentWords = countWords(currentText)
  const incomingWords = countWords(incomingText)
  const changeGroups = segments.filter(
    (segment) => segment.type !== "equal"
  ).length

  return {
    segments,
    addedWords,
    removedWords,
    unchangedWords,
    similarity: Math.round(
      (unchangedWords / Math.max(1, currentWords, incomingWords)) * 100
    ),
    changeGroups,
    granularity,
  }
}

export function limitDiffSegments(
  segments: DiffSegment[],
  maximumCharacters = 12_000,
  maximumSegments = 800
) {
  const visible: DiffSegment[] = []
  let characters = 0
  for (const segment of segments) {
    if (
      visible.length >= maximumSegments ||
      characters >= maximumCharacters
    ) {
      return { segments: visible, truncated: true }
    }
    const remaining = maximumCharacters - characters
    const text =
      segment.text.length > remaining
        ? segment.text.slice(0, remaining)
        : segment.text
    visible.push({ ...segment, text })
    characters += text.length
    if (text.length < segment.text.length) {
      return { segments: visible, truncated: true }
    }
  }
  return { segments: visible, truncated: false }
}
