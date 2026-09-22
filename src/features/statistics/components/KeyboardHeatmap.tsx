/**
 * The keys that cost you, on a keyboard.
 *
 * The sequence analysis next to it ranks transitions — the journey between two
 * keys. This is the simpler question underneath it: which key does this typist
 * miss? Shown on the layout the hands actually use, because "you miss B and Y"
 * is read at a glance as a shape on a keyboard and never as a list of letters.
 *
 * Heat is the miss rate against a fixed ceiling, not against the worst key of
 * the day: a good day should look cool everywhere rather than repainting the
 * worst key red for being marginally the worst. A key too rarely typed to judge
 * is drawn plain, because a red key on three attempts would be a lie.
 *
 * The keyboard is decoration over a table. Everything it shows is in the list
 * beside it and in the table underneath, which is what a screen reader reads.
 */

import type { CSSProperties } from 'react'

import type { KeyCost, KeyCostReport } from '@core/telemetry'

import styles from './KeyboardHeatmap.module.css'

/** A miss rate at or above this is as red as the map goes. */
const HEAT_CEILING = 0.1

/** The rows as they sit under the hands. Space is its own row, as it is its own key. */
const ROWS: readonly (readonly string[])[] = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'],
  [' '],
]

const KEY_NAMES: Readonly<Record<string, string>> = {
  ' ': 'Space',
  ';': 'Semicolon',
  ',': 'Comma',
  '.': 'Full stop',
  '/': 'Slash',
}

const nameOf = (key: string): string => KEY_NAMES[key] ?? key.toUpperCase()

const percent = (ratio: number): string => `${Math.round(ratio * 100)}%`

const describe = (key: string, cost: KeyCost | undefined): string => {
  if (cost === undefined) return `${nameOf(key)}: not typed enough to judge`
  const missed =
    cost.misses === 0 ? 'never missed' : `${cost.misses} missed of ${cost.attempts}`
  return `${nameOf(key)}: ${percent(cost.accuracy)} correct, ${missed}`
}

export interface KeyboardHeatmapProps {
  readonly report: KeyCostReport
}

export const KeyboardHeatmap = ({ report }: KeyboardHeatmapProps) => {
  const byKey = new Map(report.keys.map((cost) => [cost.key, cost]))

  return (
    <div className={styles.wrap}>
      <div className={styles.board} aria-hidden="true">
        {ROWS.map((row) => (
          <div key={row.join('')} className={styles.row}>
            {row.map((key) => {
              const cost = byKey.get(key)
              const heat =
                cost === undefined ? null : Math.min(1, (1 - cost.accuracy) / HEAT_CEILING)

              return (
                <span
                  key={key}
                  className={styles.key}
                  data-wide={key === ' ' ? '' : undefined}
                  data-judged={cost === undefined ? undefined : ''}
                  data-hot={heat !== null && heat >= 0.55 ? '' : undefined}
                  style={heat === null ? undefined : ({ '--key-heat': heat.toFixed(3) } as CSSProperties)}
                  title={describe(key, cost)}
                >
                  {key === ' ' ? '' : key}
                </span>
              )
            })}
          </div>
        ))}
      </div>

      {report.worst.length > 0 && (
        <p className={styles.worst}>
          Most missed:{' '}
          {report.worst.map((cost, index) => (
            <span key={cost.key}>
              {index > 0 && ', '}
              <span className={styles.worstKey}>{nameOf(cost.key)}</span>{' '}
              <span className={styles.worstValue}>{percent(cost.accuracy)}</span>
            </span>
          ))}
          .
        </p>
      )}

      <table className="visually-hidden">
        <caption>Accuracy by key</caption>
        <tbody>
          {report.keys.map((cost) => (
            <tr key={cost.key}>
              <th scope="row">{nameOf(cost.key)}</th>
              <td>{describe(cost.key, cost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
