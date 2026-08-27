'use client';

import { useRef, useState } from 'react';
import {
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from 'framer-motion';
import WorkflowVisual from './WorkflowVisual';
import { WORKFLOW_STEPS } from './workflow-data';

export default function Sequence() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const reducedMotion = Boolean(useReducedMotion());
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start center', 'end center'],
  });

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    const nextStep = Math.min(
      WORKFLOW_STEPS.length - 1,
      Math.max(0, Math.floor(latest * WORKFLOW_STEPS.length)),
    );
    setActiveStep((current) => (current === nextStep ? current : nextStep));
  });

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      className="workflow section-pad-lg"
      aria-labelledby="workflow-heading"
    >
      <div className="container">
        <div className="workflow-intro">
          <div>
            <p className="section-label">How it works</p>
            <h2 id="workflow-heading" className="section-heading">
              One request. One continuous journey.
            </h2>
          </div>
          <p className="section-intro">
            Every digital step moves the job toward a confirmed visit and documented
            finish. Follow the request from first detail to completed electrical work.
          </p>
        </div>

        <div className="workflow-grid">
          <ol className="workflow-steps">
            {WORKFLOW_STEPS.map((step, index) => (
              <li
                className="workflow-step"
                data-active={activeStep === index}
                key={step.number}
              >
                <div>
                  <span className="workflow-step-number">{step.number}</span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                  <span className="workflow-step-note">{step.note}</span>
                  <span className="workflow-mobile-status">{step.status}</span>
                </div>
              </li>
            ))}
          </ol>

          <div className="workflow-visual-wrap">
            <WorkflowVisual
              activeStep={activeStep}
              reducedMotion={reducedMotion}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
