/**
 * Busiest chat stretch — Sliding Window (Two Pointers)
 *
 * Input: messages sorted by createdAt ascending (Mongo sort already does this)
 * Goal: find the contiguous span with the MOST messages whose timestamps
 *       all fit inside a time window of `windowMinutes`.
 *
 * Algorithm:
 *   left = 0
 *   for right in 0..n-1:
 *     while time[right] - time[left] > windowMs:
 *       left++                    // shrink window from the left
 *     count = right - left + 1
 *     track the (left, right) with maximum count
 *
 * Complexity: O(n) time, O(1) extra space
 * Why not nested loops? Brute force is O(n²) checking every pair of bounds.
 *
 * Interview tip: this is the classic "longest/maximum subarray within constraint"
 * pattern — here the constraint is time span, the score is message count.
 */

function findBusiestWindow(messages, windowMinutes = 30) {
  const mins = Number(windowMinutes) || 30;
  const windowMs = mins * 60 * 1000;

  if (!Array.isArray(messages) || messages.length === 0) {
    return null;
  }

  const times = messages.map((m) => new Date(m.createdAt).getTime());

  let left = 0;
  let bestLeft = 0;
  let bestRight = 0;
  let bestCount = 1;

  for (let right = 0; right < times.length; right++) {
    while (times[right] - times[left] > windowMs) {
      left += 1;
    }

    const count = right - left + 1;
    if (count > bestCount) {
      bestCount = count;
      bestLeft = left;
      bestRight = right;
    }
  }

  return {
    algorithm: "sliding-window",
    complexity: "O(n) time, O(1) extra space",
    windowMinutes: mins,
    count: bestCount,
    startIndex: bestLeft,
    endIndex: bestRight,
    startMessageId: String(messages[bestLeft]._id),
    endMessageId: String(messages[bestRight]._id),
    from: messages[bestLeft].createdAt,
    to: messages[bestRight].createdAt,
  };
}

module.exports = { findBusiestWindow };
