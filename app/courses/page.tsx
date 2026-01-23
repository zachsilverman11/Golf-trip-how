import Link from 'next/link'
import { LayoutContainer, Card, Button, Badge } from '@/components/ui'
import { getCoursesAction } from '@/lib/supabase/actions'

export const dynamic = 'force-dynamic' // Always fetch fresh data

export default async function CoursesPage() {
  const { courses, error } = await getCoursesAction()

  return (
    <div className="min-h-screen bg-bg-0 py-8">
      <LayoutContainer>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl font-bold text-text-0">
            Courses
          </h1>
          <Link href="/course/new">
            <Button variant="primary">Add Course</Button>
          </Link>
        </div>

        {/* Error State */}
        {error && (
          <Card className="p-6 text-center">
            <p className="text-bad mb-4">{error}</p>
            <p className="text-sm text-text-2">
              Make sure Supabase is configured correctly.
            </p>
          </Card>
        )}

        {/* Empty State */}
        {!error && courses.length === 0 && (
          <Card className="p-8 text-center">
            <div className="h-16 w-16 rounded-full bg-bg-2 flex items-center justify-center mx-auto mb-4">
              <svg
                className="h-8 w-8 text-text-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5"
                />
              </svg>
            </div>
            <h2 className="font-display text-lg font-semibold text-text-0 mb-2">
              No courses yet
            </h2>
            <p className="text-body text-text-2 mb-6">
              Add your first course to get started.
            </p>
            <Link href="/course/new">
              <Button variant="primary">Add Course</Button>
            </Link>
          </Card>
        )}

        {/* Course List */}
        {!error && courses.length > 0 && (
          <div className="flex flex-col gap-4">
            {courses.map((course) => (
              <Card key={course.id} className="p-0 overflow-hidden">
                {/* Course Header */}
                <div className="p-4 border-b border-stroke/60">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-display text-lg font-semibold text-text-0">
                        {course.name}
                      </h3>
                      {course.location && (
                        <p className="text-sm text-text-2">{course.location}</p>
                      )}
                    </div>
                    <Badge variant={course.country === 'CA' ? 'default' : 'default'}>
                      {course.country}
                    </Badge>
                  </div>
                </div>

                {/* Tees */}
                {course.tees && course.tees.length > 0 && (
                  <div className="divide-y divide-stroke/40">
                    {course.tees.map((tee) => (
                      <div
                        key={tee.id}
                        className="flex items-center gap-4 px-4 py-3 hover:bg-bg-2/50 transition-colors"
                      >
                        {/* Tee Color Indicator */}
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{
                            backgroundColor: tee.color || getTeeColor(tee.name),
                          }}
                        />

                        {/* Tee Name */}
                        <span className="flex-1 text-body font-medium text-text-0">
                          {tee.name}
                        </span>

                        {/* Rating / Slope */}
                        <span className="font-display text-sm tabular-nums text-text-1">
                          {tee.rating} / {tee.slope}
                        </span>

                        {/* Par */}
                        <span className="text-sm text-text-2 w-16 text-right">
                          Par {tee.par}
                        </span>

                        {/* Yards */}
                        {tee.yards && (
                          <span className="text-sm text-text-2 w-20 text-right">
                            {tee.yards.toLocaleString()} yd
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* No Tees */}
                {(!course.tees || course.tees.length === 0) && (
                  <div className="p-4 text-center text-sm text-text-2">
                    No tees configured
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </LayoutContainer>
    </div>
  )
}

// Helper to get a default color based on tee name
function getTeeColor(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes('black') || lower.includes('tournament')) return '#1a1a1a'
  if (lower.includes('blue') || lower.includes('championship')) return '#0066CC'
  if (lower.includes('white')) return '#FFFFFF'
  if (lower.includes('gold') || lower.includes('yellow')) return '#FFC857'
  if (lower.includes('green')) return '#3CE6B0'
  if (lower.includes('red')) return '#FF5C7A'
  if (lower.includes('orange')) return '#FF8C42'
  return '#7E8BB0' // default gray
}
