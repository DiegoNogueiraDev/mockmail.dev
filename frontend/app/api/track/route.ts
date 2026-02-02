import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const days = searchParams.get('days') || '7';
    const limit = searchParams.get('limit') || '20';
    const page = searchParams.get('page') || '1';

    // Validate email parameter
    if (!email || !email.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Email parameter is required'
      }, { status: 400 });
    }

    // Parse and validate pagination parameters
    const limitNum = Math.min(parseInt(limit) || 20, 100); // Max 100
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const daysNum = Math.min(parseInt(days) || 7, 30); // Max 30 days

    // Build filter options
    const filterOptions: Record<string, string> = {};

    // Handle date filtering
    if (startDate) {
      filterOptions.startDate = startDate;
    }
    
    if (endDate) {
      filterOptions.endDate = endDate;
    }
    
    // Use days filter only if no specific dates provided
    if (!filterOptions.startDate && !filterOptions.endDate) {
      // Convert days to start/end dates
      const endDateObj = new Date();
      const startDateObj = new Date();
      startDateObj.setDate(startDateObj.getDate() - daysNum);
      
      filterOptions.startDate = startDateObj.toISOString();
      filterOptions.endDate = endDateObj.toISOString();
    }

    console.log(`[API] Tracking request for ${email} with options:`, filterOptions);

    // Import LogParser dynamically to avoid issues
    const { LogParser } = await import('../../../lib/logParser');
    const logParser = new LogParser();
    const allResults = await logParser.parseEmailLogs(email.trim(), filterOptions);

    if (!allResults || allResults.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: {
          total: 0,
          page: pageNum,
          totalPages: 0,
          limit: limitNum,
          hasNext: false,
          hasPrev: false
        },
        query: {
          email: email.trim(),
          ...filterOptions,
          limit: limitNum,
          page: pageNum
        },
        timestamp: new Date().toISOString()
      });
    }

    // Implement pagination
    const total = allResults.length;
    const totalPages = Math.ceil(total / limitNum);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedResults = allResults.slice(startIndex, endIndex);

    // Return structured response with pagination info
    return NextResponse.json({
      success: true,
      data: paginatedResults,
      pagination: {
        total,
        page: pageNum,
        totalPages,
        limit: limitNum,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      },
      query: {
        email: email.trim(),
        ...filterOptions,
        limit: limitNum,
        page: pageNum
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('API Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
