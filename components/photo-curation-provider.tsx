"use client"

import { createContext, useContext } from "react"
import type { CurationVisibility } from "@/lib/photo-curation"

const Context = createContext<CurationVisibility>({ ids: [], keptPortraits: [] })
export function PhotoCurationProvider({ value, children }: { value: CurationVisibility; children: React.ReactNode }) {
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function usePhotoCuration() { return useContext(Context) }
