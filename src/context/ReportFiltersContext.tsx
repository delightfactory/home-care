import React, { createContext, useContext, useState } from 'react'

export interface ReportFilters {
  filterType: 'single' | 'range'
  selectedDate: string
  startDate: string
  endDate: string
  setFilterType: React.Dispatch<React.SetStateAction<'single' | 'range'>>
  setSelectedDate: React.Dispatch<React.SetStateAction<string>>
  setStartDate: React.Dispatch<React.SetStateAction<string>>
  setEndDate: React.Dispatch<React.SetStateAction<string>>
}

const ReportFiltersContext = createContext<ReportFilters | undefined>(undefined)

export const ReportFiltersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Default to today's date as selected single date
  const [filterType, setFilterType] = useState<'single' | 'range'>('single')
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  return (
    <ReportFiltersContext.Provider
      value={{
        filterType,
        selectedDate,
        startDate,
        endDate,
        setFilterType,
        setSelectedDate,
        setStartDate,
        setEndDate
      }}
    >
      {children}
    </ReportFiltersContext.Provider>
  )
}

export function useReportFilters() {
  const ctx = useContext(ReportFiltersContext)
  if (!ctx) {
    throw new Error('useReportFilters must be used within ReportFiltersProvider')
  }
  return ctx
}
