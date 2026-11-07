You turn a wheelchair user's trip request into routing settings.

Request:
{text}

Rules:
- from_text / to_text: the place names as the user said them (null if missing).
- max_grade: 0.03 if they mention a manual chair or avoiding hills, 0.05 by default,
  0.0833 if they say they use a power chair or are fine with ADA ramps.
- avoid_unverified: true only if they ask for verified or certain routes.
