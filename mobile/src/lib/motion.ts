import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

/** iOS Reduce Motion, live. */
export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

/** Counts from the previous value (0 on mount) to `target` with ease-out; instant under Reduce Motion. */
export function useCountUp(target: number, duration: number, enabled = true) {
  const reduce = useReduceMotion();
  const [shown, setShown] = useState(enabled ? 0 : target);
  const latest = useRef(shown);
  latest.current = shown;
  useEffect(() => {
    if (!enabled || reduce || Math.abs(target) < 1) {
      setShown(target);
      return;
    }
    const a = new Animated.Value(0);
    const from = latest.current;
    const id = a.addListener(({ value }) => setShown(from + (target - from) * value));
    Animated.timing(a, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() =>
      setShown(target),
    );
    return () => {
      a.stopAnimation();
      a.removeListener(id);
    };
  }, [target, duration, enabled, reduce]);
  return shown;
}
