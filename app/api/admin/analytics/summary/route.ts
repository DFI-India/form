import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function GET(request: NextRequest) {
  try {
    // Verify auth
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Check if user is admin or dfi_staff
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, centre_eac_no')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'dfi_staff', 'dfi_field_staff'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Centre-scope every query for dfi_field_staff (single-centre role), matching the
    // scoping convention used in approvals/list and records/list. admin and dfi_staff
    // are oversight roles and continue to see system-wide numbers.
    const shouldScopeToCentre = profile.role === 'dfi_field_staff' && Boolean(profile.centre_eac_no)
    const scopedEacNo = profile.centre_eac_no

    const { count: totalEacs } = await supabaseAdmin
      .from('centre_data')
      .select('*', { count: 'exact', head: true })

    // Get total children counts by status
    let pendingQuery = supabaseAdmin.from('Child_Data').select('*', { count: 'exact', head: true }).eq('status', 'Pending')
    let approvedQuery = supabaseAdmin.from('Child_Data').select('*', { count: 'exact', head: true }).eq('status', 'Approved')
    let rejectedQuery = supabaseAdmin.from('Child_Data').select('*', { count: 'exact', head: true }).eq('status', 'Rejected')
    if (shouldScopeToCentre) {
      pendingQuery = pendingQuery.eq('eac_no', scopedEacNo)
      approvedQuery = approvedQuery.eq('eac_no', scopedEacNo)
      rejectedQuery = rejectedQuery.eq('eac_no', scopedEacNo)
    }
    const [pendingRes, approvedRes, rejectedRes] = await Promise.all([pendingQuery, approvedQuery, rejectedQuery])

    // Get total children by centre
    let centreDataQuery = supabaseAdmin.from('Child_Data').select('eac_no, village_name')
    if (shouldScopeToCentre) centreDataQuery = centreDataQuery.eq('eac_no', scopedEacNo)
    const { data: centreData } = await centreDataQuery
      .then(res => ({
        data: res.data?.reduce((acc: any[], row: any) => {
          const existing = acc.find(c => c.eac_no === row.eac_no)
          if (existing) existing.count++
          else acc.push({ eac_no: row.eac_no, village_name: row.village_name, count: 1 })
          return acc
        }, []) || []
      }))

    // Get top submitting volunteers
    let volunteerBaseQuery = supabaseAdmin.from('Child_Data').select('submitted_by')
    if (shouldScopeToCentre) volunteerBaseQuery = volunteerBaseQuery.eq('eac_no', scopedEacNo)
    const { data: volunteerData } = await volunteerBaseQuery
      .then(async (res) => {
        if (!res.data) return { data: [] }
        const submitted = res.data.reduce((acc: any[], row: any) => {
          if (row.submitted_by) {
            const existing = acc.find(v => v.user_id === row.submitted_by)
            if (existing) existing.count++
            else acc.push({ user_id: row.submitted_by, count: 1 })
          }
          return acc
        }, [])

        // Get usernames for volunteers
        const userIds = Array.from(new Set(submitted.map(v => v.user_id)))
        const { data: users } = await supabaseAdmin
          .from('profiles')
          .select('id, username')
          .in('id', userIds)

        return {
          data: submitted
            .map(s => ({
              ...s,
              username: users?.find(u => u.id === s.user_id)?.username || 'Unknown'
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
        }
      })

    // Get VTC enrollment trends
    let vocationalDataQuery = supabaseAdmin.from('vocational_course').select('course_name, status')
    let totalVocationalQuery = supabaseAdmin.from('vocational_course').select('*', { count: 'exact', head: true })
    let approvedVocationalQuery = supabaseAdmin.from('vocational_course').select('*', { count: 'exact', head: true }).eq('status', 'Approved')
    let computerDataQuery = supabaseAdmin.from('computer_course').select('course_name, status')
    if (shouldScopeToCentre) {
      vocationalDataQuery = vocationalDataQuery.eq('eac_no', scopedEacNo)
      totalVocationalQuery = totalVocationalQuery.eq('eac_no', scopedEacNo)
      approvedVocationalQuery = approvedVocationalQuery.eq('eac_no', scopedEacNo)
      computerDataQuery = computerDataQuery.eq('eac_no', scopedEacNo)
    }

    const { data: vocationalData } = await vocationalDataQuery
    const { count: totalVocationalStudents } = await totalVocationalQuery
    const { count: totalApprovedVocationalStudents } = await approvedVocationalQuery
    const { data: computerData } = await computerDataQuery

    const vocationCourses = vocationalData?.reduce((acc: any, row: any) => {
      const existing = acc.find((c: any) => c.course === row.course_name)
      if (existing) existing.count++
      else acc.push({ course: row.course_name, count: 1 })
      return acc
    }, []) || []

    const computerCourses = computerData?.reduce((acc: any, row: any) => {
      const existing = acc.find((c: any) => c.course === row.course_name)
      if (existing) existing.count++
      else acc.push({ course: row.course_name, count: 1 })
      return acc
    }, []) || []

    // Get approval timeline data (last 30 days by status)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    let timelineQuery = supabaseAdmin
      .from('Child_Data')
      .select('created_at, status')
      .gte('created_at', thirtyDaysAgo.toISOString())
    if (shouldScopeToCentre) timelineQuery = timelineQuery.eq('eac_no', scopedEacNo)
    const { data: timelineData } = await timelineQuery

    const timeline = Array.from({ length: 30 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (29 - i))
      const dateStr = date.toISOString().split('T')[0]
      const dayData = timelineData?.filter(t => t.created_at?.split('T')[0] === dateStr) || []
      return {
        date: dateStr,
        pending: dayData.filter(d => d.status === 'Pending').length,
        approved: dayData.filter(d => d.status === 'Approved').length,
        rejected: dayData.filter(d => d.status === 'Rejected').length
      }
    })

    // Get gender distribution
    let allChildrenQuery = supabaseAdmin
      .from('Child_Data')
      .select('gender, adm_date, dateofbirth, class_std_text')
    if (shouldScopeToCentre) allChildrenQuery = allChildrenQuery.eq('eac_no', scopedEacNo)
    const { data: allChildren } = await allChildrenQuery

    const genderStats = allChildren?.reduce((acc: any, child: any) => {
      const gender = child.gender || 'Unknown'
      acc[gender] = (acc[gender] || 0) + 1
      return acc
    }, {}) || {}

    // Age distribution from dateofbirth
    const ageGroups = allChildren?.reduce((acc: any, child: any) => {
      const dobValue = child.dateofbirth
      if (!dobValue) {
        acc.Unknown = (acc.Unknown || 0) + 1
        return acc
      }

      const dob = new Date(dobValue)
      if (Number.isNaN(dob.getTime())) {
        acc.Unknown = (acc.Unknown || 0) + 1
        return acc
      }

      const now = new Date()
      let age = now.getFullYear() - dob.getFullYear()
      const monthDiff = now.getMonth() - dob.getMonth()
      if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
        age -= 1
      }

      let group = 'Unknown'
      if (age <= 10) group = '6-10'
      else if (age <= 14) group = '11-14'
      else if (age <= 18) group = '15-18'
      else if (age > 18) group = '18+'
      acc[group] = (acc[group] || 0) + 1
      return acc
    }, {}) || {}

    // Grade distribution
    const gradeStats = allChildren?.reduce((acc: any, child: any) => {
      const grade = child.class_std_text || 'Unknown'
      acc[grade] = (acc[grade] || 0) + 1
      return acc
    }, {}) || {}

    return NextResponse.json({
      success: true,
      summary: {
        totalEacs: totalEacs || 0,
        totalVocationalStudents: totalVocationalStudents || 0,
        totalApprovedVocationalStudents: totalApprovedVocationalStudents || 0,
        totalApprovedChildren: approvedRes.count || 0,
        totalPending: pendingRes.count || 0,
        totalApproved: approvedRes.count || 0,
        totalRejected: rejectedRes.count || 0,
        totalChildren: (pendingRes.count || 0) + (approvedRes.count || 0) + (rejectedRes.count || 0)
      },
      byStatus: {
        pending: pendingRes.count || 0,
        approved: approvedRes.count || 0,
        rejected: rejectedRes.count || 0
      },
      byCentre: centreData,
      topVolunteers: volunteerData,
      vocationalCourses: vocationCourses,
      computerCourses: computerCourses,
      timeline: timeline,
      genderDistribution: genderStats,
      ageDistribution: ageGroups,
      gradeDistribution: gradeStats
    })
  } catch (error: any) {
    console.error('Analytics error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
