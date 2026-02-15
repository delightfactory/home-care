// GPS Utilities — حساب المسافة والتحقق من نطاق الموقع
// يُستخدم للتحقق من وجود الفنى ضمن نطاق مواقع الشركة عند تسجيل الحضور

import { CompanyLocationsAPI } from '../api/hr'
import type { CompanyLocation } from '../types/hr.types'

interface GpsCoord {
    lat: number
    lng: number
    accuracy?: number
}

interface ProximityResult {
    isWithinRange: boolean
    nearestLocation: CompanyLocation | null
    distanceMeters: number
    message: string
}

/**
 * حساب المسافة بين نقطتين باستخدام صيغة Haversine
 * @returns المسافة بالمتر
 */
export function haversineDistance(
    coord1: { lat: number; lng: number },
    coord2: { lat: number; lng: number }
): number {
    const R = 6371000 // نصف قطر الأرض بالمتر
    const toRad = (deg: number) => (deg * Math.PI) / 180

    const dLat = toRad(coord2.lat - coord1.lat)
    const dLng = toRad(coord2.lng - coord1.lng)

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(coord1.lat)) *
        Math.cos(toRad(coord2.lat)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
}

/**
 * التحقق من قرب الفنى من أحد مواقع الشركة
 * 
 * الآلية:
 * 1. جلب المواقع النشطة
 * 2. حساب المسافة لكل موقع
 * 3. إضافة هامش سماحية (tolerance) يراعى دقة GPS للأجهزة المختلفة:
 *    - إذا كانت دقة GPS معروفة → نضيفها كهامش
 *    - حد أدنى للهامش: 50 متر (لتغطية الأجهزة المتوسطة)
 *    - حد أقصى للهامش: 150 متر (لمنع التلاعب)
 * 4. الفنى يكون ضمن النطاق إذا: المسافة ≤ (radius + tolerance)
 */
export async function validateGpsProximity(
    position: GpsCoord
): Promise<ProximityResult> {
    try {
        const locations = await CompanyLocationsAPI.getActiveLocations()

        if (locations.length === 0) {
            // لا توجد مواقع مسجلة → نسمح بالتسجيل
            return {
                isWithinRange: true,
                nearestLocation: null,
                distanceMeters: 0,
                message: 'لا توجد مواقع شركة مسجلة — التسجيل مسموح',
            }
        }

        // حساب هامش السماحية بناءً على دقة GPS
        // الأجهزة المتوسطة: 30-100م  |  أجهزة ضعيفة: 100-300م
        const MIN_TOLERANCE = 50   // متر — حد أدنى
        const MAX_TOLERANCE = 150  // متر — حد أقصى
        const gpsAccuracy = position.accuracy || MIN_TOLERANCE
        const tolerance = Math.min(MAX_TOLERANCE, Math.max(MIN_TOLERANCE, gpsAccuracy))

        let nearestLocation: CompanyLocation | null = null
        let minDistance = Infinity

        for (const loc of locations) {
            const distance = haversineDistance(
                { lat: position.lat, lng: position.lng },
                { lat: Number(loc.latitude), lng: Number(loc.longitude) }
            )

            if (distance < minDistance) {
                minDistance = distance
                nearestLocation = loc
            }
        }

        const effectiveRadius = (nearestLocation?.radius_meters || 200) + tolerance
        const isWithinRange = minDistance <= effectiveRadius

        if (isWithinRange) {
            return {
                isWithinRange: true,
                nearestLocation,
                distanceMeters: Math.round(minDistance),
                message: `✅ أنت ضمن نطاق "${nearestLocation?.name_ar}" (${Math.round(minDistance)}م)`,
            }
        } else {
            return {
                isWithinRange: false,
                nearestLocation,
                distanceMeters: Math.round(minDistance),
                message: `⚠️ أنت خارج النطاق المسموح — أقرب موقع "${nearestLocation?.name_ar}" على بعد ${Math.round(minDistance)}م (المسموح: ${effectiveRadius}م)`,
            }
        }
    } catch (error: any) {
        // عند فشل جلب المواقع → نسمح بالتسجيل مع تحذير
        console.warn('GPS validation fallback:', error)
        return {
            isWithinRange: true,
            nearestLocation: null,
            distanceMeters: 0,
            message: 'تعذر التحقق من الموقع — التسجيل مسموح مؤقتاً',
        }
    }
}
