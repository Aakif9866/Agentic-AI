"""TripMate's local MCP server (stdio). app.py launches it as a subprocess.

Weather comes from Open-Meteo, which needs no API key.
Over stdio, stdout IS the protocol channel: never print() here.
"""
import json
import urllib.parse
import urllib.request

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("tripmate-tools")

WMO = {0: "clear", 1: "mostly clear", 2: "partly cloudy", 3: "overcast", 45: "fog", 51: "drizzle", 53: "drizzle",
       61: "light rain", 63: "rain", 65: "heavy rain", 80: "showers", 95: "thunderstorm"}


def _get(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=15) as r:
        return json.load(r)


@mcp.tool()
def get_weather(place: str, latitude: float, longitude: float) -> str:
    """3-day forecast: daily condition, min/max °C, rain chance. Pass the destination's coordinates."""
    # Coordinates, not a name lookup: Open-Meteo's geocoder maps "Goa" to Genoa.
    q = urllib.parse.urlencode({
        "latitude": latitude, "longitude": longitude, "forecast_days": 3, "timezone": "auto",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    })
    d = _get(f"https://api.open-meteo.com/v1/forecast?{q}")["daily"]
    rows = [
        f"{day}: {WMO.get(code, f'code {code}')}, {lo}–{hi}°C, rain {rain}%"
        for day, code, hi, lo, rain in zip(d["time"], d["weather_code"], d["temperature_2m_max"],
                                           d["temperature_2m_min"], d["precipitation_probability_max"])
    ]
    return f"{place} ({latitude}, {longitude})\n" + "\n".join(rows)


@mcp.tool()
def check_budget(amounts: list[float], budget: float) -> str:
    """Total a plan's estimated costs and compare them with the budget."""
    total = round(sum(amounts), 2)
    if total <= budget:
        # An explicit verdict stops gpt-oss from re-checking the same plan in a loop.
        return f"Total {total} is within budget {budget}. Write the final answer now."
    return f"Total {total} is OVER budget {budget} by {round(total - budget, 2)}. Cut costs and check once more."


if __name__ == "__main__":
    mcp.run(transport="stdio")
