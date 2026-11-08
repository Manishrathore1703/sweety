export const slotLabels = {
  morning_fasting: 'Morning fasting',
  after_breakfast: 'After breakfast',
  after_lunch: 'After lunch',
  after_dinner: 'After dinner',
};

export const getRequestDisplayName = (request) => {
  return request?.other_user_name || request?.other_user_email || 'Request contact';
};

export const formatStatus = (status) => {
  if (!status) {
    return 'unknown';
  }

  return String(status).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};
