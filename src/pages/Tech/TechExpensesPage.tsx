// TechExpensesPage - صفحة مصروفات الفريق للفنى (قائد الفريق فقط)
import React from 'react'
import TechLayout from '../../components/Layout/TechLayout'
import TechExpensesList from '../../components/Tech/TechExpensesList'
import { useTechnicianData } from '../../hooks/useTechnicianData'

const TechExpensesPage: React.FC = () => {
    const { status, refresh } = useTechnicianData()

    return (
        <TechLayout onRefresh={refresh} isLeader={status?.isLeader || false}>
            <TechExpensesList />
        </TechLayout>
    )
}

export default TechExpensesPage
