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

    // Build filters for non-admin users
    const isAdmin = profile.role === 'admin'
    const centreFilter = !isAdmin && profile.centre_eac_no ? { eac_no: profile.centre_eac_no } : {}

    const { count: totalEacs } = await supabaseAdmin
      .from('centre_data')
      .select('*', { count: 'exact', head: true })

    // Get total children counts by status
    const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
      supabaseAdmin.from('Child_Data').select('*', { count: 'exact', head: true }).eq('status', 'Pending'),
      supabaseAdmin.from('Child_Data').select('*', { count: 'exact', head: true }).eq('status', 'Approved'),
      supabaseAdmin.from('Child_Data').select('*', { count: 'exact', head: true }).eq('status', 'Rejected'),
    ])

    // Get total children by centre
    const { data: centreData } = await supabaseAdmin
      .from('Child_Data')
      .select('eac_no, village_name')
      .then(res => ({
        data: res.data?.reduce((acc: any[], row: any) => {
          const existing = acc.find(c => c.eac_no === row.eac_no)
          if (existing) existing.count++
          else acc.push({ eac_no: row.eac_no, village_name: row.village_name, count: 1 })
          return acc
        }, []) || []
      }))

    // Get top submitting volunteers
    const { data: volunteerData } = await supabaseAdmin
      .from('Child_Data')
      .select('submitted_by')
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
    const { data: vocationalData } = await supabaseAdmin
      .from('vocational_course')
      .select('course_name, status')

    const { count: totalVocationalStudents } = await supabaseAdmin
      .from('vocational_course')
      .select('*', { count: 'exact', head: true })

    const { count: totalApprovedVocationalStudents } = await supabaseAdmin
      .from('vocational_course')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Approved')

    const { data: computerData } = await supabaseAdmin
      .from('computer_course')
      .select('course_name, status')

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

    const { data: timelineData } = await supabaseAdmin
      .from('Child_Data')
      .select('created_at, status')
      .gte('created_at', thirtyDaysAgo.toISOString())

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
    const { data: allChildren } = await supabaseAdmin
      .from('Child_Data')
      .select('gender, adm_date, dateofbirth, class_std_text')

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
