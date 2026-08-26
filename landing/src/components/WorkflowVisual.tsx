'use client';

import Image from 'next/image';
import {
  CalendarCheck,
  Camera,
  Check,
  CheckCircle2,
  CreditCard,
  FileCheck2,
  Inbox,
  Mail,
  Send,
  Wrench,
} from 'lucide-react';
import { AnimatePresence, motion, type MotionValue } from 'framer-motion';
import { WORKFLOW_STEPS } from './workflow-data';

type WorkflowVisualProps = {
  activeStep: number;
  progress: MotionValue<number>;
  reducedMotion: boolean;
};

export default function WorkflowVisual({
  activeStep,
  progress,
  reducedMotion,
}: WorkflowVisualProps) {
  const step = WORKFLOW_STEPS[activeStep];

  return (
    <div className="workflow-visual" aria-hidden="true">
      <div className="workflow-visual-head">
        <span>FieldQuote service record</span>
        <span className="workflow-visual-count">
          {step.number} / {WORKFLOW_STEPS.length.toString().padStart(2, '0')}
        </span>
      </div>

      <svg className="workflow-circuit" viewBox="0 0 620 620" fill="none">
        <path
          d="M35 112H126C166 112 166 168 206 168H318C358 168 358 226 398 226H585"
          stroke="rgba(240,244,248,0.12)"
          strokeWidth="2"
        />
        <path
          d="M35 310H94C134 310 134 258 174 258H282C322 258 322 366 362 366H468C508 366 508 314 548 314H585"
          stroke="rgba(240,244,248,0.12)"
          strokeWidth="2"
        />
        <path
          d="M35 508H148C188 508 188 452 228 452H342C382 452 382 506 422 506H585"
          stroke="rgba(240,244,248,0.12)"
          strokeWidth="2"
        />
        <motion.path
          d="M35 112H126C166 112 166 168 206 168H318C358 168 358 310 398 310H468C508 310 508 506 548 506H585"
          stroke="#00E0C4"
          strokeWidth="3"
          strokeLinecap="round"
          style={{ pathLength: reducedMotion ? 1 : progress }}
        />
        {[35, 206, 398, 468, 585].map((cx, index) => (
          <circle
            key={cx}
            cx={cx}
            cy={[112, 168, 310, 310, 506][index]}
            r="7"
            fill="#0B1D2C"
            stroke="#00E0C4"
            strokeWidth="2"
          />
        ))}
      </svg>

      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          className="workflow-stage"
          key={activeStep}
          initial={reducedMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
          transition={{ duration: reducedMotion ? 0 : 0.38, ease: [0.16, 1, 0.3, 1] }}
        >
          <StageContent activeStep={activeStep} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function StageContent({ activeStep }: { activeStep: number }) {
  switch (activeStep) {
    case 0:
      return (
        <StageFrame label="Customer request" status="New">
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
            <Camera size={16} /> 2 photos attached
          </div>
        </StageFrame>
      );
    case 1:
      return (
        <StageFrame label="Service inbox" status="Received">
          <div className="stage-message">
            <span className="stage-message-icon">
              <Mail size={20} />
            </span>
            <div>
              <strong>New electrical request</strong>
              <p>Description, timing, address, and media grouped into one record.</p>
            </div>
          </div>
          <ul className="stage-checklist">
            <StageCheck text="Customer details structured" />
            <StageCheck text="Job evidence attached" />
            <StageCheck text="Ready for team review" />
          </ul>
          <div className="stage-action">
            <Inbox size={16} /> Added to the request inbox
          </div>
        </StageFrame>
      );
    case 2:
      return (
        <StageFrame label="Quote workspace" status="Reviewed">
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
            <Send size={16} /> Secure quote sent
          </div>
        </StageFrame>
      );
    case 3:
      return (
        <StageFrame label="Customer quote" status="Accepted">
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
            <CreditCard size={16} /> Stripe hosted checkout
          </div>
        </StageFrame>
      );
    case 4:
      return (
        <StageFrame label="Appointment" status="Scheduled">
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
            <CalendarCheck size={16} /> Visit confirmed
          </div>
        </StageFrame>
      );
    case 5:
      return (
        <StageFrame label="Technician record" status="Completed">
          <div className="stage-photo">
            <Image
              src="/images/images.jpeg"
              alt=""
              fill
              sizes="440px"
            />
            <span className="stage-photo-label">Completion photo added</span>
          </div>
          <ul className="stage-checklist">
            <StageCheck text="Work notes recorded" />
            <StageCheck text="At least one completion photo required" />
          </ul>
          <div className="stage-action">
            <Wrench size={16} /> Job marked complete
          </div>
        </StageFrame>
      );
    default:
      return (
        <StageFrame label="Completion record" status="Complete">
          <div className="stage-complete">
            <span className="stage-complete-icon">
              <Check size={22} />
            </span>
            <div>
              <strong>Electrical work completed</strong>
              <p>Photos and technician notes are attached to the job.</p>
            </div>
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
            <CheckCircle2 size={16} /> Journey complete
          </div>
        </StageFrame>
      );
  }
}

function StageFrame({
  label,
  status,
  children,
}: {
  label: string;
  status: string;
  children: React.ReactNode;
}) {
  return (
    <div className="stage-object">
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
      <FileCheck2 size={16} />
      {text}
    </li>
  );
}
