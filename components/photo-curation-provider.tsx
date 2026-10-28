"use client"

import { createContext, useContext } from "react"
import { emptyCuration } from "@/lib/photo-curation"
import type { CurationVisibility } from "@/lib/photo-curation"

const Context = createContext<CurationVisibility>(emptyCuration)
export function PhotoCurationProvider({ value, children }: { value: CurationVisibility; children: React.ReactNode }) {
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function usePhotoCuration() { return useContext(Context) }
