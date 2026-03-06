import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import DatePickerPopup from '../shared/DatePickerPopup.jsx';
import { formatDateDisplay } from '../../utils/dateUtils.js';
import './NullableDatePicker.css';

/**
 * NullableDatePicker - Custom date picker for Editor that supports null/empty dates.
 *
 * This component replaces the default svar date picker because svar's DatePicker
 * always requires a date value and doesn't support clearing dates to null.
 *
 * Features:
 * - Displays date or "None" when empty
 * - Click to open date picker popover
 * - Clear button in popover to set date to null
 * - Works with the Editor's onChange/onchange pattern
 *
 * UI Design: Uses shared DatePickerPopup via Portal with viewport-aware positioning
 * so the calendar never gets clipped by the SharedEditor's boundaries.
 *
 * @param {Object} props
 * @param {Date|null} props.value - Current date value (can be null)
 * @param {Function} props.onChange - Change handler: ({ value: Date|null }) => void
 * @param {Function} props.onchange - Alternative change handler (svar convention)
 * @param {string} props.label - Field label
 * @param {boolean} props.disabled - If true, disable editing
 */
/**
 * DatePickerPortal — renders DatePickerPopup in a portal, positioned relative to the trigger.
 * Uses ResizeObserver to reposition after the SVAR Calendar async-renders its content.
 */
function DatePickerPortal({ value, triggerRef, pickerRef, onDateSelect, onClear }) {
  const popupRef = useRef(null);

  // Assign to parent's pickerRef for click-outside detection
  const setRef = useCallback((el) => {
    popupRef.current = el;
    pickerRef.current = el;
  }, [pickerRef]);

  // Position popup relative to trigger, with viewport-aware flip.
  // Uses ResizeObserver because the SVAR Calendar renders its content asynchronously,
  // so the popup height is 0 on first layout — we must reposition once it has real size.
  useEffect(() => {
    const el = popupRef.current;
    const trigger = triggerRef.current;
    if (!el || !trigger) return;

    const position = () => {
      const rect = trigger.getBoundingClientRect();
      const popupHeight = el.offsetHeight;
      const popupWidth = el.offsetWidth;

      if (popupHeight === 0) return; // Calendar not yet rendered

      const spaceBelow = window.innerHeight - rect.top;
      const spaceAbove = rect.top;
      let top;
      if (spaceBelow < popupHeight && spaceAbove >= popupHeight) {
        top = rect.top - popupHeight;
      } else {
        top = rect.top;
      }

      let left = rect.left;
      if (left + popupWidth > window.innerWidth - 8) {
        left = window.innerWidth - popupWidth - 8;
      }
      if (left < 8) left = 8;

      el.style.top = `${top}px`;
      el.style.left = `${left}px`;
      el.style.visibility = 'visible';
    };

    const ro = new ResizeObserver(() => {
      position();
      // Disconnect after first successful positioning — Calendar only needs one resize
      if (el.offsetHeight > 0) ro.disconnect();
    });
    ro.observe(el);

    return () => ro.disconnect();
  }, [triggerRef]);

  return createPortal(
    <DatePickerPopup
      value={value}
      onDateSelect={onDateSelect}
      onClear={onClear}
      popupRef={setRef}
      style={{
        position: 'fixed',
        zIndex: 10000,
        // Start hidden to prevent flash at wrong position; revealed after positioning
        visibility: 'hidden',
      }}
    />,
    document.body
  );
}

export default function NullableDatePicker(props) {
  const { value, onChange, onchange, label, disabled = false } = props;
  const onChangeHandler = onChange ?? onchange;

  const [showPicker, setShowPicker] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const pickerRef = useRef(null);

  // Check if we have a valid date
  const hasDate = value instanceof Date && !isNaN(value.getTime());

  // Handle date selection from DatePicker
  const handleDateSelect = useCallback(
    (newDate) => {
      if (onChangeHandler) {
        onChangeHandler({ value: newDate });
      }
      setShowPicker(false);
    },
    [onChangeHandler]
  );

  // Handle clear button (in popup)
  const handleClear = useCallback(() => {
    if (onChangeHandler) {
      onChangeHandler({ value: null });
    }
    setShowPicker(false);
  }, [onChangeHandler]);

  // Open picker
  const handleOpenPicker = useCallback(() => {
    if (!disabled) {
      setShowPicker(true);
    }
  }, [disabled]);

  // Close picker when clicking outside
  useEffect(() => {
    if (!showPicker) return;

    const handleClickOutside = (e) => {
      // Check if click is inside container or picker
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        pickerRef.current &&
        !pickerRef.current.contains(e.target)
      ) {
        setShowPicker(false);
      }
    };

    // Use setTimeout to prevent immediate close
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPicker]);

  // Close on Escape key
  useEffect(() => {
    if (!showPicker) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowPicker(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showPicker]);

  const displayValue = formatDateDisplay(value);
  const isNone = !hasDate;

  // Inline style for "None" text - using --wx-color-font-alt because --wx-color-secondary is transparent in willow theme
  const noneStyle = isNone ? { color: 'var(--wx-color-font-alt, #9fa1ae)' } : {};

  if (disabled) {
    return (
      <div className="nullable-date-picker disabled">
        <span className="nullable-date-value" style={noneStyle}>
          {displayValue}
        </span>
      </div>
    );
  }

  return (
    <div className="nullable-date-picker" ref={containerRef}>
      {/* Clickable date display */}
      <span
        ref={triggerRef}
        className="nullable-date-value clickable"
        style={noneStyle}
        onClick={handleOpenPicker}
        title={hasDate ? 'Click to edit date' : 'Click to set date'}
      >
        {displayValue}
      </span>

      {/* Picker popup via Portal — viewport-aware positioning prevents clipping by SharedEditor */}
      {showPicker && (
        <DatePickerPortal
          value={value}
          triggerRef={triggerRef}
          pickerRef={pickerRef}
          onDateSelect={handleDateSelect}
          onClear={handleClear}
        />
      )}
    </div>
  );
}
