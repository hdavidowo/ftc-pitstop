import { NextResponse } from "next/server"
import { DateTime } from "luxon"

const FTC_API_BASE = "https://ftc-api.firstinspires.org/v2.0"

interface Event {
  code: string
  name: string
  dateStart: string
  dateEnd: string
  venue: string
  city: string
  stateprov: string
  country: string
  timezone: string
}

export async function GET() {
  try {
    const season = 2024
    const auth = Buffer.from(`${process.env.FTC_USERNAME}:${process.env.FTC_API_KEY}`).toString("base64")

    console.log("Fetching upcoming events...")

    const response = await fetch(`${FTC_API_BASE}/${season}/events`, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("API Error:", errorText)
      return NextResponse.json({
        success: false,
        error: errorText,
      })
    }

    const data = await response.json()
    const allEvents = data.events || []
    
    allEvents.forEach((event: Event) => {
      const eventStart = DateTime.fromISO(event.dateStart, { zone: event.timezone })
      event.dateStart = eventStart.toUTC().toISO() ?? event.dateStart

      const eventEnd = DateTime.fromISO(event.dateEnd, { zone: event.timezone }).endOf("day")
      event.dateEnd = eventEnd.toUTC().toISO() ?? event.dateEnd
    });

    // Filter for upcoming and current events
    const now = new Date()
    const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

    const upcomingEvents = allEvents
      .filter((event: Event) => {
        const eventStart = new Date(event.dateStart)
        const eventEnd = new Date(event.dateEnd)
        // Include events that are currently happening or starting within 2 weeks
        return eventEnd >= now && eventStart <= twoWeeksFromNow
      })
      .sort((a: Event, b: Event) => {
        // Sort by start date, with current events first
        const aStart = new Date(a.dateStart)
        const bStart = new Date(b.dateStart)
        const aIsLive = new Date(a.dateStart) <= now && new Date(a.dateEnd) >= now
        const bIsLive = new Date(b.dateStart) <= now && new Date(b.dateEnd) >= now

        if (aIsLive && !bIsLive) return -1
        if (!aIsLive && bIsLive) return 1
        return aStart.getTime() - bStart.getTime()
      })

    console.log(`Found ${upcomingEvents.length} upcoming events out of ${allEvents.length} total events`)

    return NextResponse.json({
      success: true,
      events: upcomingEvents,
      totalEvents: allEvents.length,
    })
  } catch (error) {
    console.error("Error fetching upcoming events:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
