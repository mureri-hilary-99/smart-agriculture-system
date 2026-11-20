"""Weather provider boundary (external service, not IoT sensors).

`StubWeatherProvider` is the default so the API works offline. Set
`WEATHER_PROVIDER=open_meteo` to use the real HTTP provider.
"""
import json
import math
import urllib.parse
import urllib.request
from typing import Any, Dict


class WeatherProvider:
    def current(self, latitude: float, longitude: float) -> Dict[str, float]:
        raise NotImplementedError

    @property
    def name(self) -> str:
        raise NotImplementedError


class StubWeatherProvider(WeatherProvider):
    """Offline deterministic readings, derived from the farm coordinates."""

    @property
    def name(self) -> str:
        return "stub"

    def current(self, latitude: float, longitude: float) -> Dict[str, float]:
        latitude_factor = abs(math.sin(latitude / 12.0))
        longitude_factor = abs(math.cos(longitude / 17.0))
        return {
            "temperature": round(18.0 + latitude_factor * 12.0, 2),
            "humidity": round(45.0 + longitude_factor * 35.0, 2),
            "rainfall": round((latitude_factor + longitude_factor) * 22.0, 2),
        }


class OpenMeteoWeatherProvider(WeatherProvider):
    def __init__(self, base_url: str, timeout_seconds: float):
        self._base_url = base_url
        self._timeout = timeout_seconds

    @property
    def name(self) -> str:
        return "open_meteo"

    def current(self, latitude: float, longitude: float) -> Dict[str, float]:
        query = urllib.parse.urlencode(
            {
                "latitude": latitude,
                "longitude": longitude,
                "current": "temperature_2m,relative_humidity_2m,precipitation",
                "timezone": "auto",
            }
        )
        url = f"{self._base_url}?{query}"
        request = urllib.request.Request(url, headers={"User-Agent": "smart-agriculture-api/1.0"})
        with urllib.request.urlopen(request, timeout=self._timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
        current = payload["current"]
        return {
            "temperature": float(current["temperature_2m"]),
            "humidity": float(current["relative_humidity_2m"]),
            "rainfall": float(current["precipitation"]),
        }


def build_weather_provider(name: str, base_url: str, timeout: float) -> WeatherProvider:
    if name == "open_meteo":
        return OpenMeteoWeatherProvider(base_url, timeout)
    return StubWeatherProvider()
