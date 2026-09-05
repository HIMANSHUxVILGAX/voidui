import { useState, useEffect } from 'react'

export function useLocalStorage(key: string, defaultValue: string): [string, (val: string) => void] {
  const [value, setValue] = useState<string>(() => {
    return localStorage.getItem(key) || defaultValue
  })

  useEffect(() => {
    localStorage.setItem(key, value)
  }, [key, value])

  return [value, setValue]
}

export function useLocalStorageBool(key: string, defaultValue: boolean): [boolean, (val: boolean | ((prev: boolean) => boolean)) => void] {
  const [value, setValue] = useState<boolean>(() => {
    const stored = localStorage.getItem(key)
    if (stored === null) return defaultValue
    return stored !== 'false'
  })

  useEffect(() => {
    localStorage.setItem(key, value.toString())
  }, [key, value])

  return [value, setValue]
}
