/**
 * Golf Course API Validation Script
 *
 * Tests golfcourseapi.com to verify data completeness:
 * - US course (Bandon Dunes)
 * - Canadian course (Glen Abbey)
 * - Vancouver-area course
 *
 * Run: npx tsx scripts/test-golf-api.ts
 *
 * Requires: GOLF_API_KEY environment variable
 * Sign up at https://golfcourseapi.com to get your free API key
 */

const API_BASE = 'https://api.golfcourseapi.com/v1';

interface HoleData {
  par?: number;
  yardage?: number;
  handicap?: number; // stroke index
}

interface TeeData {
  tee_name?: string;
  total_yards?: number;
  par_total?: number;
  course_rating?: number;  // hoping this exists
  slope_rating?: number;   // hoping this exists
  holes?: HoleData[];
}

interface CourseSearchResult {
  id: string;
  club_name?: string;
  course_name?: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
}

interface CourseDetails {
  id?: string;
  club_name?: string;
  course_name?: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  tees?: {
    male?: Record<string, TeeData>;
    female?: Record<string, TeeData>;
  };
  // Capture any other fields
  [key: string]: unknown;
}

async function searchCourses(query: string): Promise<CourseSearchResult[]> {
  const apiKey = process.env.GOLF_API_KEY;
  if (!apiKey) {
    throw new Error('GOLF_API_KEY environment variable is required. Sign up at https://golfcourseapi.com');
  }

  const response = await fetch(`${API_BASE}/search?search_query=${encodeURIComponent(query)}`, {
    headers: {
      'Authorization': `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Search failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  return data.courses || [];
}

async function getCourseDetails(courseId: string): Promise<CourseDetails> {
  const apiKey = process.env.GOLF_API_KEY;
  if (!apiKey) {
    throw new Error('GOLF_API_KEY environment variable is required');
  }

  const response = await fetch(`${API_BASE}/courses/${courseId}`, {
    headers: {
      'Authorization': `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Get course failed (${response.status}): ${text}`);
  }

  return response.json();
}

function inspectTeeData(tees: Record<string, TeeData> | undefined, gender: string): void {
  if (!tees) {
    console.log(`    No ${gender} tees found`);
    return;
  }

  for (const [teeName, tee] of Object.entries(tees)) {
    console.log(`    ${teeName}:`);
    console.log(`      Par Total: ${tee.par_total ?? 'MISSING'}`);
    console.log(`      Total Yards: ${tee.total_yards ?? 'MISSING'}`);
    console.log(`      Course Rating: ${(tee as any).course_rating ?? (tee as any).rating ?? 'MISSING'}`);
    console.log(`      Slope Rating: ${(tee as any).slope_rating ?? (tee as any).slope ?? 'MISSING'}`);

    if (tee.holes && tee.holes.length > 0) {
      const hole1 = tee.holes[0];
      console.log(`      Hole 1 sample: par=${hole1.par ?? 'MISSING'}, handicap/SI=${hole1.handicap ?? 'MISSING'}, yards=${hole1.yardage ?? 'MISSING'}`);
    } else {
      console.log(`      Holes: MISSING`);
    }
  }
}

async function testCourse(name: string, searchQuery: string): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${name}`);
  console.log(`Search query: "${searchQuery}"`);
  console.log('='.repeat(60));

  try {
    // Search
    console.log('\n1. Searching...');
    const results = await searchCourses(searchQuery);

    if (results.length === 0) {
      console.log('   ❌ No results found');
      return;
    }

    console.log(`   ✓ Found ${results.length} result(s)`);

    // Show first few results
    results.slice(0, 3).forEach((r, i) => {
      console.log(`   [${i + 1}] ${r.club_name || r.course_name} - ${r.location?.city}, ${r.location?.state || r.location?.country}`);
    });

    // Get details for first result
    const courseId = results[0].id;
    console.log(`\n2. Fetching details for course ID: ${courseId}`);

    const details = await getCourseDetails(courseId);

    console.log(`\n3. Course Info:`);
    console.log(`   Club: ${details.club_name}`);
    console.log(`   Course: ${details.course_name}`);
    console.log(`   Location: ${details.location?.city}, ${details.location?.state}, ${details.location?.country}`);

    // Inspect for any slope/rating fields at root level
    console.log(`\n4. Raw fields at root level:`);
    const knownFields = ['id', 'club_name', 'course_name', 'location', 'tees'];
    for (const [key, value] of Object.entries(details)) {
      if (!knownFields.includes(key)) {
        console.log(`   ${key}: ${JSON.stringify(value)}`);
      }
    }

    console.log(`\n5. Tee Data (Male):`);
    inspectTeeData(details.tees?.male, 'male');

    console.log(`\n6. Tee Data (Female):`);
    inspectTeeData(details.tees?.female, 'female');

    // Dump first tee's raw data for inspection
    if (details.tees?.male) {
      const firstTeeKey = Object.keys(details.tees.male)[0];
      if (firstTeeKey) {
        console.log(`\n7. Raw first tee object (for inspection):`);
        console.log(JSON.stringify(details.tees.male[firstTeeKey], null, 2));
      }
    }

  } catch (error) {
    console.log(`   ❌ Error: ${error instanceof Error ? error.message : error}`);
  }
}

async function main(): Promise<void> {
  console.log('Golf Course API Validation');
  console.log('==========================');
  console.log(`API Base: ${API_BASE}`);
  console.log(`API Key: ${process.env.GOLF_API_KEY ? '✓ Set' : '❌ Missing'}`);

  if (!process.env.GOLF_API_KEY) {
    console.log('\n❌ Please set GOLF_API_KEY environment variable');
    console.log('   Sign up at https://golfcourseapi.com to get your free API key');
    console.log('\n   Then run: GOLF_API_KEY=your_key npx tsx scripts/test-golf-api.ts');
    process.exit(1);
  }

  // Test US course
  await testCourse('Bandon Dunes (Oregon, US)', 'Bandon Dunes');

  // Test Canadian course
  await testCourse('Glen Abbey (Ontario, Canada)', 'Glen Abbey');

  // Test Vancouver area
  await testCourse('Vancouver Area Course', 'Furry Creek');

  console.log('\n\n' + '='.repeat(60));
  console.log('SUMMARY - Required Fields for Handicap Calculation:');
  console.log('='.repeat(60));
  console.log('Check above output for:');
  console.log('  ✓ Course Rating (required for handicap calc)');
  console.log('  ✓ Slope Rating (required for handicap calc)');
  console.log('  ✓ Par per hole (required for scoring)');
  console.log('  ✓ Stroke Index per hole (required for net scoring)');
  console.log('\nIf slope/rating are MISSING, we need to:');
  console.log('  A) Switch to golfapi.io (confirmed to have slope/rating)');
  console.log('  B) Require manual entry for slope/rating in Review Scorecard');
}

main().catch(console.error);
