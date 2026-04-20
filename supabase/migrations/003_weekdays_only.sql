-- Rename exclude_holidays → weekdays_only. Flag now means "weekdays only"
-- (Mon–Fri and non-Japanese-holiday).

alter table events rename column exclude_holidays to weekdays_only;
