import { useEffect, useState } from 'react'

import {
  airDensityPercent,
  NO_WEATHER,
  STANDARD_TEMPERATURE,
  windComponents,
  type Weather,
} from './ballistics'
import {
  numberToField,
  parseNumber,
  readStored,
  writeStored,
} from './input'
import type { JournalWeather, WindMode } from './journal'

function abs(value: number | null | undefined) {
  return value === null || value === undefined ? value : Math.abs(value)
}

/** The wind speed magnitude with the sign of the chosen direction. */
function signedWind(value: number | null, positive: boolean): number | null {
  if (value === null) return null
  return positive ? Math.abs(value) : -Math.abs(value)
}

/**
 * The state of the weather fields and their conversion into conditions for the ballistics.
 *
 * azimuthDeg is needed for the "speed and direction" mode: the wind
 * is split into head and cross components relative to
 * the line of fire.
 */
export function useWeatherInputs(
  saved: JournalWeather | null,
  enabled: boolean,
  azimuthDeg: number | null
) {
  const [windMode, setWindMode] = useState<WindMode>(
    () =>
      saved?.windMode ??
      readStored<WindMode>('windMode', ['vector', 'components'], 'vector')
  )
  const [windSpeed, setWindSpeed] = useState(numberToField(saved?.windSpeed))
  const [windFrom, setWindFrom] = useState(numberToField(saved?.windFrom))

  // Kestrel shows the wind magnitude without a sign, so
  // the direction is chosen with a separate button, and the field holds the magnitude.
  const [headwind, setHeadwind] = useState(
    numberToField(abs(saved?.headwind))
  )
  const [headSide, setHeadSide] = useState<'head' | 'tail'>(
    (saved?.headwind ?? 0) < 0 ? 'tail' : 'head'
  )
  const [crosswind, setCrosswind] = useState(
    numberToField(abs(saved?.crosswind))
  )
  const [crossSide, setCrossSide] = useState<'right' | 'left'>(
    (saved?.crosswind ?? 0) < 0 ? 'left' : 'right'
  )

  const [temperature, setTemperature] = useState(
    numberToField(saved?.temperature)
  )
  const [pressure, setPressure] = useState(numberToField(saved?.pressure))

  useEffect(() => {
    writeStored('windMode', windMode)
  }, [windMode])

  const temperatureValue = parseNumber(temperature)
  const pressureValue = parseNumber(pressure)
  const densityValue =
    pressureValue !== null && pressureValue > 0
      ? airDensityPercent(
          temperatureValue ?? STANDARD_TEMPERATURE,
          pressureValue
        )
      : null

  const windSpeedValue = parseNumber(windSpeed)
  const windFromValue = parseNumber(windFrom)
  const headwindValue = signedWind(parseNumber(headwind), headSide === 'head')
  const crosswindValue = signedWind(
    parseNumber(crosswind),
    crossSide === 'right'
  )

  let wind = { headwind: 0, crosswind: 0 }
  let windIncomplete = false

  if (windMode === 'vector') {
    if (windSpeedValue !== null && windSpeedValue !== 0) {
      if (windFromValue !== null && azimuthDeg !== null) {
        wind = windComponents(windSpeedValue, windFromValue, azimuthDeg)
      } else {
        windIncomplete = true
      }
    }
  } else {
    wind = {
      headwind: headwindValue ?? 0,
      crosswind: crosswindValue ?? 0,
    }
  }

  const weather: Weather = enabled
    ? { ...wind, temperature: temperatureValue, density: densityValue }
    : NO_WEATHER

  const fields =
    windMode === 'vector'
      ? [windSpeed, windFrom, temperature, pressure]
      : [headwind, crosswind, temperature, pressure]
  const entered = fields.some((v) => v.trim() !== '')

  function reset() {
    setWindSpeed('')
    setWindFrom('')
    setHeadwind('')
    setCrosswind('')
    setTemperature('')
    setPressure('')
  }

  function toJournal(): JournalWeather | null {
    if (!enabled || !entered) return null
    return {
      windMode,
      windSpeed: windSpeedValue,
      windFrom: windFromValue,
      headwind: headwindValue,
      crosswind: crosswindValue,
      temperature: temperatureValue,
      pressure: pressureValue,
    }
  }

  return {
    windMode,
    setWindMode,
    windSpeed,
    setWindSpeed,
    windFrom,
    setWindFrom,
    headwind,
    setHeadwind,
    headSide,
    setHeadSide,
    crosswind,
    setCrosswind,
    crossSide,
    setCrossSide,
    temperature,
    setTemperature,
    pressure,
    setPressure,

    wind,
    windIncomplete,
    temperatureValue,
    densityValue,
    weather,
    fields,
    entered,
    reset,
    toJournal,
  }
}

export type WeatherInputs = ReturnType<typeof useWeatherInputs>
