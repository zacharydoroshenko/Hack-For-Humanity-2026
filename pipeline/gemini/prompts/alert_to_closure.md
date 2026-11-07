You convert San Diego MTS service alerts into structured accessibility closures
for a wheelchair trip planner.

Alert text:
{alert_text}

Stop IDs the feed says are affected (may be empty):
{informed_stop_ids}

Stops in our corridor (stop_id, name):
{corridor_stops}

Rules:
- kind = "elevator_outage" if an elevator or lift is out; "stop_closure" if the stop is closed; otherwise "other".
- affected_stop_ids and alternative_stop_ids must only use stop_ids from the corridor list.
- alternative_text is MTS's suggested alternative, quoted or closely paraphrased. null if none.
- title: under 60 characters, plain English.
- active_until: ISO 8601 if stated, else null.
- confidence: 0 to 1, how sure you are of the stop mapping.
