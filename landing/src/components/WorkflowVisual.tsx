'use client';

import Image from 'next/image';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  type CircuitCardSide,
  type CircuitPoint,
  WORKFLOW_CIRCUIT_PATH,
  WORKFLOW_CIRCUIT_POINTS,
  WORKFLOW_CIRCUIT_SEGMENTS,
  WORKFLOW_CIRCUIT_VIEWBOX,
  WORKFLOW_STEPS,
} from './workflow-data';

type WorkflowVisualProps = {
  activeStep: number;
  reducedMotion: boolean;
};

const CARD_GAP = 32;
const CARD_FALLBACK_W = 268;
const CARD_FALLBACK_H = 210;
const ARROW_INSET = 18;

type CardAnchor = {
  left: number;
  top: number;
  side: CircuitCardSide;
  arrowX: number;
  arrowY: number;
};

function pickCardSide(
  point: CircuitPoint,
  anchor: { x: number; y: number },
  cardW: number,
  cardH: number,
  surfaceW: number,
  surfaceH: number,
  pad: number,
): CircuitCardSide {
  const needX = cardW + CARD_GAP;
  const needY = cardH + CARD_GAP;
  const room: Record<CircuitCardSide, boolean> = {
    left: anchor.x - pad >= needX,
    right: surfaceW - pad - anchor.x >= needX,
    below: surfaceH - pad - anchor.y >= needY,
    above: anchor.y - pad >= needY,
  };

  return point.place.find((side) => room[side]) ?? point.place[0];
}

function placeCard(
  side: CircuitCardSide,
  anchor: { x: number; y: number },
  cardW: number,
  cardH: number,
  surfaceW: number,
  surfaceH: number,
  pad: number,
) {
  if (side === 'right') {
    return {
      left: clamp(anchor.x + CARD_GAP, pad, Math.max(pad, surfaceW - pad - cardW)),
      top: clamp(anchor.y - cardH / 2, pad, Math.max(pad, surfaceH - cardH - pad)),
    };
  }
  if (side === 'left') {
    return {
      left: clamp(
        anchor.x - CARD_GAP - cardW,
        pad,
        Math.max(pad, surfaceW - pad - cardW),
      ),
      top: clamp(anchor.y - cardH / 2, pad, Math.max(pad, surfaceH - cardH - pad)),
    };
  }
  if (side === 'above') {
    return {
      left: clamp(anchor.x - cardW / 2, pad, Math.max(pad, surfaceW - pad - cardW)),
      top: clamp(
        anchor.y - CARD_GAP - cardH,
        pad,
        Math.max(pad, surfaceH - cardH - pad),
      ),
    };
  }
  return {
    left: clamp(anchor.x - cardW / 2, pad, Math.max(pad, surfaceW - pad - cardW)),
    top: clamp(anchor.y + CARD_GAP, pad, Math.max(pad, surfaceH - cardH - pad)),
  };
}

function arrowOnCard(
  side: CircuitCardSide,
  anchor: { x: number; y: number },
  pos: { left: number; top: number },
  cardW: number,
  cardH: number,
) {
  return {
    arrowX: clamp(anchor.x - pos.left, ARROW_INSET, Math.max(ARROW_INSET, cardW - ARROW_INSET)),
    arrowY: clamp(anchor.y - pos.top, ARROW_INSET, Math.max(ARROW_INSET, cardH - ARROW_INSET)),
  };
}

function circuitPointState(
  index: number,
  activeStep: number,
  hoveredStep: number | null,
) {
  const reference = hoveredStep ?? activeStep;
  if (index < reference) return 'completed';
  if (index === reference) return 'active';
  return 'pending';
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mapPointToSurface(
  point: { cx: number; cy: number },
  surfaceEl: HTMLElement,
  svgEl: SVGSVGElement,
) {
  const surfaceRect = surfaceEl.getBoundingClientRect();
  const svgRect = svgEl.getBoundingClientRect();
  const scaleX = svgRect.width / WORKFLOW_CIRCUIT_VIEWBOX.width;
  const scaleY = svgRect.height / WORKFLOW_CIRCUIT_VIEWBOX.height;

  return {
    x: point.cx * scaleX + (svgRect.left - surfaceRect.left),
    y: point.cy * scaleY + (svgRect.top - surfaceRect.top),
  };
}

export default function WorkflowVisual({
  activeStep,
  reducedMotion,
}: WorkflowVisualProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<SVGSVGElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [isExploring, setIsExploring] = useState(false);
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);
  const [cardAnchor, setCardAnchor] = useState<CardAnchor>({
    left: 0,
    top: 0,
    side: 'right',
    arrowX: 24,
    arrowY: 24,
  });

  const displayStep = hoveredStep ?? activeStep;
  const step = WORKFLOW_STEPS[displayStep];
  const pathReference = hoveredStep ?? activeStep;
  const pathLength = (pathReference + 1) / WORKFLOW_STEPS.length;
  const showCard = !isExploring || hoveredStep !== null;
  const isAnchored = isExploring && hoveredStep !== null;

  const leaveCircuit = () => {
    setIsExploring(false);
    setHoveredStep(null);
  };

  const updateCardPosition = useCallback(() => {
    if (hoveredStep === null || !isExploring) return;

    const surface = surfaceRef.current;
    const svg = trackRef.current;
    const stage = stageRef.current;
    if (!surface || !svg || !stage) return;

    const point = WORKFLOW_CIRCUIT_POINTS[hoveredStep];
    const anchor = mapPointToSurface(point, surface, svg);
    const cardW = stage.offsetWidth || CARD_FALLBACK_W;
    const cardH = stage.offsetHeight || CARD_FALLBACK_H;
    const pad = 12;
    const side = pickCardSide(
      point,
      anchor,
      cardW,
      cardH,
      surface.clientWidth,
      surface.clientHeight,
      pad,
    );
    const pos = placeCard(
      side,
      anchor,
      cardW,
      cardH,
      surface.clientWidth,
      surface.clientHeight,
      pad,
    );
    const arrow = arrowOnCard(side, anchor, pos, cardW, cardH);

    setCardAnchor({ left: pos.left, top: pos.top, side, ...arrow });
  }, [hoveredStep, isExploring]);

  useLayoutEffect(() => {
    updateCardPosition();
  }, [updateCardPosition, displayStep]);

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || !isAnchored) return;

    const observer = new ResizeObserver(() => updateCardPosition());
    observer.observe(surface);
    if (stageRef.current) observer.observe(stageRef.current);

    return () => observer.disconnect();
  }, [isAnchored, updateCardPosition]);

  return (
    <div className="workflow-visual">
      <div className="workflow-visual-head">
        <span>FieldQuote service record</span>
        <span className="workflow-visual-count">
          {step.number} / {WORKFLOW_STEPS.length.toString().padStart(2, '0')}
        </span>
      </div>

      <p className="workflow-visual-mark" aria-hidden="true">
        <span>Field</span>
        <span>Quote</span>
      </p>

      <div
        ref={surfaceRef}
        className="workflow-circuit-surface"
        data-exploring={isExploring}
        onMouseEnter={() => setIsExploring(true)}
        onMouseLeave={leaveCircuit}
      >
        <svg
          ref={trackRef}
          className="workflow-circuit workflow-circuit--track"
          viewBox={`0 0 ${WORKFLOW_CIRCUIT_VIEWBOX.width} ${WORKFLOW_CIRCUIT_VIEWBOX.height}`}
          fill="none"
          aria-hidden="true"
        >
          <path
            className="workflow-circuit-base"
            d={WORKFLOW_CIRCUIT_PATH}
          />
          <motion.path
            className="workflow-circuit-active"
            d={WORKFLOW_CIRCUIT_PATH}
            stroke="#00E0C4"
            strokeWidth="2"
            strokeLinecap="round"
            initial={false}
            animate={{ pathLength }}
            transition={
              reducedMotion
                ? { duration: 0 }
                : { duration: 0.45, ease: [0.16, 1, 0.3, 1] }
            }
          />
          {WORKFLOW_CIRCUIT_POINTS.map((point, index) => {
            const state = circuitPointState(index, activeStep, hoveredStep);
            const isHovered = hoveredStep === index;

            return (
              <circle
                key={`track-point-${point.cx}-${point.cy}`}
                className="workflow-point-core"
                cx={point.cx}
                cy={point.cy}
                r={state === 'active' || isHovered ? 9 : 7}
                data-state={state}
                data-hovered={isHovered}
              />
            );
          })}
        </svg>

        <AnimatePresence mode="popLayout" initial={false}>
          {showCard && (
            <motion.div
              ref={stageRef}
              className={
                isAnchored
                  ? `workflow-stage workflow-stage--anchored workflow-stage--side-${cardAnchor.side}`
                  : 'workflow-stage workflow-stage--centered'
              }
              key={displayStep}
              style={
                isAnchored
                  ? {
                      left: cardAnchor.left,
                      top: cardAnchor.top,
                      ['--arrow-x' as string]: `${cardAnchor.arrowX}px`,
                      ['--arrow-y' as string]: `${cardAnchor.arrowY}px`,
                    }
                  : undefined
              }
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{
                duration: reducedMotion ? 0 : 0.28,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              {isAnchored && (
                <span className="workflow-stage-arrow" aria-hidden="true" />
              )}
              <StageContent activeStep={displayStep} compact={isAnchored} />
            </motion.div>
          )}
        </AnimatePresence>

        <svg
          className="workflow-circuit workflow-circuit--interact"
          viewBox={`0 0 ${WORKFLOW_CIRCUIT_VIEWBOX.width} ${WORKFLOW_CIRCUIT_VIEWBOX.height}`}
          fill="none"
          aria-label="Service journey progress"
        >
          {WORKFLOW_CIRCUIT_SEGMENTS.map((segment, index) => (
            <path
              key={`segment-${index}`}
              className="workflow-segment-hit"
              d={segment}
              onMouseEnter={() =>
                setHoveredStep(Math.min(index + 1, WORKFLOW_STEPS.length - 1))
              }
            />
          ))}
          {WORKFLOW_CIRCUIT_POINTS.map((point, index) => (
            <circle
              key={`hit-${point.cx}-${point.cy}`}
              className="workflow-point-hit"
              cx={point.cx}
              cy={point.cy}
              r="22"
              onMouseEnter={() => setHoveredStep(index)}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

function StageContent({
  activeStep,
  compact = false,
}: {
  activeStep: number;
  compact?: boolean;
}) {
  switch (activeStep) {
    case 0:
      return (
        <StageFrame label="Customer request" status="New" compact={compact}>
          <h3 className="stage-title">Consumer unit keeps tripping</h3>
          <div className="stage-field">
            <span>Preferred timing</span>
            <strong>As soon as possible</strong>
          </div>
          <div className="stage-field">
            <span>Service address</span>
            <strong>Included securely</strong>
          </div>
          <div className="stage-action">
            2 photos attached
            <span className="stage-action-arrow" aria-hidden="true" />
          </div>
        </StageFrame>
      );
    case 1:
      return (
        <StageFrame label="Service inbox" status="Received" compact={compact}>
          <div className="stage-message">
            <strong>New electrical request</strong>
            <p>Description, timing, address, and media grouped into one record.</p>
          </div>
          <ul className="stage-checklist">
            <StageCheck text="Customer details structured" />
            <StageCheck text="Job evidence attached" />
            <StageCheck text="Ready for team review" />
          </ul>
          <div className="stage-action">
            Added to the request inbox
            <span className="stage-action-arrow" aria-hidden="true" />
          </div>
        </StageFrame>
      );
    case 2:
      return (
        <StageFrame label="Quote workspace" status="Reviewed" compact={compact}>
          <h3 className="stage-title">Prepared from the approved price book</h3>
          <div className="stage-field">
            <span>Consumer unit inspection</span>
            <strong>Matched</strong>
          </div>
          <div className="stage-field">
            <span>Fault diagnosis</span>
            <strong>Matched</strong>
          </div>
          <ul className="stage-checklist">
            <StageCheck text="Scope checked by the service team" />
            <StageCheck text="Unmatched work requires manual pricing" />
          </ul>
          <div className="stage-action">
            Secure quote sent
            <span className="stage-action-arrow" aria-hidden="true" />
          </div>
        </StageFrame>
      );
    case 3:
      return (
        <StageFrame label="Customer quote" status="Accepted" compact={compact}>
          <h3 className="stage-title">Scope and totals ready to approve</h3>
          <div className="stage-field">
            <span>Quote access</span>
            <strong>Private token link</strong>
          </div>
          <div className="stage-field">
            <span>Deposit</span>
            <strong>Required before scheduling</strong>
          </div>
          <div className="stage-action stage-action--lime">
            Stripe hosted checkout
            <span className="stage-action-arrow" aria-hidden="true" />
          </div>
        </StageFrame>
      );
    case 4:
      return (
        <StageFrame label="Appointment" status="Scheduled" compact={compact}>
          <div className="stage-calendar">
            <div className="stage-calendar-date">
              <strong>AM</strong>
              Visit
            </div>
            <div>
              <strong>Appointment window confirmed</strong>
              <p>Technician assigned by the service team</p>
            </div>
          </div>
          <ul className="stage-checklist">
            <StageCheck text="Customer receives the visit details" />
            <StageCheck text="Job appears in the technician dashboard" />
          </ul>
          <div className="stage-action">
            Visit confirmed
            <span className="stage-action-arrow" aria-hidden="true" />
          </div>
        </StageFrame>
      );
    case 5:
      return (
        <StageFrame label="Technician record" status="Completed" compact={compact}>
          <div className="stage-photo">
            <Image
              src="/images/panel-work.jpg"
              alt=""
              fill
              sizes="440px"
              quality={70}
            />
            <span className="stage-photo-label">Completion photo added</span>
          </div>
          <ul className="stage-checklist">
            <StageCheck text="Work notes recorded" />
            <StageCheck text="At least one completion photo required" />
          </ul>
          <div className="stage-action">
            Job marked complete
            <span className="stage-action-arrow" aria-hidden="true" />
          </div>
        </StageFrame>
      );
    default:
      return (
        <StageFrame label="Completion record" status="Complete" compact={compact}>
          <div className="stage-complete">
            <strong>Electrical work completed</strong>
            <p>Photos and technician notes are attached to the job.</p>
          </div>
          <div className="stage-field">
            <span>Completion evidence</span>
            <strong>Available</strong>
          </div>
          <div className="stage-field">
            <span>Remaining balance</span>
            <strong>Secure payment link</strong>
          </div>
          <div className="stage-action stage-action--lime">
            Journey complete
            <span className="stage-action-arrow" aria-hidden="true" />
          </div>
        </StageFrame>
      );
  }
}

function StageFrame({
  label,
  status,
  compact = false,
  children,
}: {
  label: string;
  status: string;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={compact ? 'stage-object stage-object--compact' : 'stage-object'}>
      <div className="stage-bar">
        <span>{label}</span>
        <span className="stage-status">{status}</span>
      </div>
      <div className="stage-body">{children}</div>
    </div>
  );
}

function StageCheck({ text }: { text: string }) {
  return (
    <li>
      <span className="stage-check-mark" aria-hidden="true" />
      {text}
    </li>
  );
}
