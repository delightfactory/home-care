import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { BonusesAPI, WorkerBonus } from '../api/bonuses'

interface Options {
  month?: string // YYYY-MM-01
  minDaily?: number
  commission?: number
  auto?: boolean // fetch immediately
}

export const useBonuses = (options: Options = {}) => {
  const {
    month = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10),
    minDaily,
    commission,
    auto = true
  } = options

  const [data, setData] = useState<WorkerBonus[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBonuses = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await BonusesAPI.getWorkerBonuses(month, minDaily, commission)
      setData(res)
    } catch (err: any) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [month, minDaily, commission])

  useEffect(() => {
    if (auto) {
      fetchBonuses()
    }
  }, [fetchBonuses, auto])

  return { data, loading, error, refresh: fetchBonuses }
}
