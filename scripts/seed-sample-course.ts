/**
 * Seed Script: Create a sample course for testing
 *
 * Run: npx tsx scripts/seed-sample-course.ts
 *
 * Requires: Supabase env vars in .env.local
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load env vars from .env.local
config({ path: '.env.local' })
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function seed() {
  console.log('Seeding sample course...')

  // 1. Create course
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .upsert(
      {
        id: 'a0000000-0000-0000-0000-000000000001',
        name: 'Sample Golf Club',
        location: 'San Francisco, CA',
        country: 'US',
        external_provider: null,
        external_id: null,
      },
      { onConflict: 'id' }
    )
    .select()
    .single()

  if (courseError) {
    console.error('Failed to create course:', courseError)
    process.exit(1)
  }

  console.log('Created course:', course.name)

  // 2. Create tee
  const { data: tee, error: teeError } = await supabase
    .from('tees')
    .upsert(
      {
        id: 'b0000000-0000-0000-0000-000000000001',
        course_id: course.id,
        name: 'Blue',
        color: '#0066CC',
        rating: 71.2,
        slope: 128,
        par: 72,
        yards: 6500,
        gender: 'male',
      },
      { onConflict: 'id' }
    )
    .select()
    .single()

  if (teeError) {
    console.error('Failed to create tee:', teeError)
    process.exit(1)
  }

  console.log('Created tee:', tee.name)

  // 3. Delete existing holes for this tee (to allow re-seeding)
  await supabase.from('holes').delete().eq('tee_id', tee.id)

  // 4. Create 18 holes
  const holes = Array.from({ length: 18 }, (_, i) => {
    const n = i + 1
    return {
      tee_id: tee.id,
      hole_number: n,
      par: n === 3 || n === 7 || n === 12 || n === 16 ? 3 : n === 5 || n === 9 || n === 14 || n === 18 ? 5 : 4,
      stroke_index: n,
      yards: 350 + n * 10,
    }
  })

  const { error: holesError } = await supabase.from('holes').insert(holes)

  if (holesError) {
    console.error('Failed to create holes:', holesError)
    process.exit(1)
  }

  console.log('Created 18 holes')
  console.log('')
  console.log('Sample course seeded successfully!')
  console.log(`Course ID: ${course.id}`)
  console.log(`Tee ID: ${tee.id}`)
}

seed().catch(console.error)
