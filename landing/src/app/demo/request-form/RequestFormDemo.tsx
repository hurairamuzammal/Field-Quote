'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CircleCheck,
  Lock,
  Mic,
  Send,
  Square,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import styles from './request-form.module.css';

/** Mirrors supabase/functions/submit-request/index.ts so the demo fails where the server fails. */
const RULES = {
  nameMin: 2,
  nameMax: 80,
  addressMin: 8,
  addressMax: 200,
  descMin: 20,
  descMax: 4000,
  maxPhotos: 5,
};

const hasLetter = (v: string) => /\p{L}/u.test(v);
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

type Step = 1 | 2 | 'done';

export default function RequestFormDemo() {
  const [step, setStep] = useState<Step>(1);
  const [showOld, setShowOld] = useState(false);

  const [desc, setDesc] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [audio, setAudio] = useState<number | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [best, setBest] = useState('');

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [tried, setTried] = useState(false);

  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!recording) return;
    timer.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [recording]);

  const hasMedia = photos.length > 0 || audio !== null;

  // Step 1 — description OR media, and 20 chars if a description is the only thing given.
  const descError = (() => {
    if (hasMedia) return null;
    if (!desc.trim()) return 'Describe the job, add a photo, or record a voice note.';
    if (desc.trim().length < RULES.descMin)
      return `A bit more detail please — ${RULES.descMin - desc.trim().length} more characters.`;
    if (desc.length > RULES.descMax) return 'That is longer than we can accept.';
    return null;
  })();
  const step1Valid = !descError;

  // Step 2 — name is required even though the live form never says so.
  const nameError = (() => {
    const v = name.trim();
    if (!v) return 'We need a name for the quote.';
    if (v.length < RULES.nameMin || v.length > RULES.nameMax || !hasLetter(v))
      return 'Enter a valid name.';
    return null;
  })();
  const emailError = email.trim() && isEmail(email.trim()) ? null : 'Enter a valid email.';
  const addressError = (() => {
    const v = address.trim();
    if (v.length < RULES.addressMin || v.length > RULES.addressMax)
      return 'Include the street and postcode.';
    return null;
  })();
  const step2Valid = !nameError && !emailError && !addressError;

  function stopRecording() {
    setRecording(false);
    setAudio(elapsed || 1);
  }

  function addPhoto() {
    if (photos.length >= RULES.maxPhotos) return;
    const labels = ['fusebox.jpg', 'kitchen-socket.jpg', 'meter.jpg', 'oven.jpg', 'hallway.jpg'];
    setPhotos((p) => [...p, labels[p.length] ?? `photo-${p.length + 1}.jpg`]);
  }

  const recapText =
    audio !== null && !desc.trim()
      ? `Voice note — ${audio}s`
      : desc.trim() || 'Nothing described yet';

  return (
    <main className={styles.page}>
      <header className={styles.demoBar}>
        <span className={styles.demoTag}>Proposed UI</span>
        <p>
          Interactive mockup. Nothing is sent — validation mirrors{' '}
          <code>submit-request</code> so it fails exactly where the real one does.
        </p>
        <button
          type="button"
          className={styles.compare}
          onClick={() => setShowOld((v) => !v)}
          aria-pressed={showOld}
        >
          {showOld ? 'Hide' : 'Show'} what it looks like today
        </button>
      </header>

      {showOld && <OldForm />}

      <div className={styles.shell}>
        <div className={styles.split}>
          <section className={styles.form}>
            {step === 'done' ? (
              <Done
                name={name.trim()}
                email={email.trim()}
                onReset={() => {
                  setStep(1);
                  setDesc('');
                  setPhotos([]);
                  setAudio(null);
                  setName('');
                  setEmail('');
                  setPhone('');
                  setAddress('');
                  setBest('');
                  setTried(false);
                  setElapsed(0);
                }}
              />
            ) : (
              <>
                <div className={styles.bar}>
                  <span style={{ width: step === 1 ? '50%' : '100%' }} />
                </div>

                {step === 1 ? (
                  <>
                    <p className={styles.stepno}>Step 1 of 2 · about a minute</p>
                    <h1 className={styles.h1}>
                      What&rsquo;s the <em>problem?</em>
                    </h1>

                    <button
                      type="button"
                      className={`${styles.rec} ${recording ? styles.recOn : ''}`}
                      onClick={() => (recording ? stopRecording() : (setElapsed(0), setRecording(true)))}
                    >
                      {recording ? <Square size={20} /> : <Mic size={22} />}
                      <span>
                        <b>{recording ? `Recording… ${elapsed}s` : 'Tap to record'}</b>
                        {recording ? 'Tap again when you are done' : 'Easiest if you are stood in front of it'}
                      </span>
                      {recording && <i className={styles.pulse} aria-hidden />}
                    </button>

                    {audio !== null && !recording && (
                      <p className={styles.clip}>
                        <CircleCheck size={15} /> Voice note saved — {audio}s
                        <button type="button" onClick={() => setAudio(null)} aria-label="Delete voice note">
                          <Trash2 size={14} />
                        </button>
                      </p>
                    )}

                    <p className={styles.or}>
                      <span>or type it</span>
                    </p>

                    <label className={styles.field}>
                      <textarea
                        className={styles.ta}
                        value={desc}
                        maxLength={RULES.descMax}
                        onChange={(e) => setDesc(e.target.value)}
                        placeholder="The consumer unit trips every time the oven goes on. Started last week — the kitchen sockets are dead too."
                        rows={4}
                      />
                    </label>
                    <div className={styles.meta}>
                      <span className={styles.hint}>
                        A sentence or two.{' '}
                        <b>{RULES.descMin} characters minimum</b>, or record instead.
                      </span>
                      <span className={styles.count}>
                        {desc.length} / {RULES.descMax}
                      </span>
                    </div>

                    <button type="button" className={styles.photoBtn} onClick={addPhoto}>
                      <Camera size={15} />
                      <span>Add photos</span>
                      <em>
                        {photos.length}/{RULES.maxPhotos} · 10&nbsp;MB each
                      </em>
                    </button>

                    {photos.length > 0 && (
                      <ul className={styles.photos}>
                        {photos.map((p, i) => (
                          <li key={p}>
                            {p}
                            <button
                              type="button"
                              onClick={() => setPhotos((x) => x.filter((_, j) => j !== i))}
                              aria-label={`Remove ${p}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {tried && descError && (
                      <p className={styles.err}>
                        <TriangleAlert size={14} />
                        {descError}
                      </p>
                    )}

                    <button
                      type="button"
                      className={styles.submit}
                      onClick={() => (step1Valid ? (setStep(2), setTried(false)) : setTried(true))}
                      aria-disabled={!step1Valid}
                      data-off={!step1Valid || undefined}
                    >
                      Next — where are you?
                      <ArrowRight size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <p className={styles.stepno}>
                      <button type="button" className={styles.back} onClick={() => setStep(1)}>
                        <ArrowLeft size={13} /> Back
                      </button>
                      Step 2 of 2
                    </p>
                    <h1 className={styles.h1}>
                      Where should we <em>come?</em>
                    </h1>

                    <Field
                      label="Address"
                      hint="Postcode included — it sets the call-out rate."
                      value={address}
                      onChange={setAddress}
                      placeholder="14 Hartwell Road, Manchester M17 1PB"
                      error={tried ? addressError : null}
                    />

                    <div className={styles.grid}>
                      <Field
                        label="Your name"
                        value={name}
                        onChange={setName}
                        placeholder="Jordan Hale"
                        error={tried ? nameError : null}
                      />
                      <Field
                        label="Email"
                        value={email}
                        onChange={setEmail}
                        placeholder="jordan@example.com"
                        type="email"
                        error={tried ? emailError : null}
                      />
                    </div>

                    <div className={styles.grid}>
                      <Field label="Phone" optional value={phone} onChange={setPhone} placeholder="07700 900812" />
                      <Field
                        label="Best time"
                        optional
                        value={best}
                        onChange={setBest}
                        placeholder="Weekday mornings"
                      />
                    </div>

                    <div className={styles.recap}>
                      <CircleCheck size={17} />
                      <span>
                        <b>{recapText}</b>
                        {photos.length > 0 && `${photos.length} photo${photos.length > 1 ? 's' : ''} · `}
                        {audio !== null && desc.trim() && `voice note · `}
                        <button type="button" onClick={() => setStep(1)}>
                          edit
                        </button>
                      </span>
                    </div>

                    <button
                      type="button"
                      className={styles.submit}
                      onClick={() => (step2Valid ? setStep('done') : setTried(true))}
                      aria-disabled={!step2Valid}
                      data-off={!step2Valid || undefined}
                    >
                      <Send size={15} />
                      Get my quote
                    </button>
                    <p className={styles.trust}>
                      <Lock size={13} /> We only use these to price and book the job.
                    </p>
                  </>
                )}
              </>
            )}
          </section>

          <aside className={styles.side}>
            <span className={styles.kick}>
              <i />
              Free estimate
            </span>
            <span className={styles.stack}>
              <b>PRICED</b>
              <b>IN MINUTES</b>
            </span>
            <p className={styles.marker}>
              not next
              <br />
              Tuesday
            </p>
            <ol className={styles.next}>
              <li>
                <i>1</i>
                <span>
                  <b>You describe it</b>Type it, or just talk.
                </span>
              </li>
              <li>
                <i>2</i>
                <span>
                  <b>We price it</b>Off a real rate card, not a guess.
                </span>
              </li>
              <li>
                <i>3</i>
                <span>
                  <b>You pick a slot</b>Only if the number works for you.
                </span>
              </li>
            </ol>
            <p className={styles.small}>No card. No account. No visit needed to give you a number.</p>
          </aside>
        </div>
      </div>

      <section className={styles.notes}>
        <h2>What changed, and why</h2>
        <ul>
          <li>
            <b>The problem comes first.</b> The live form opens with Name and Email — a stranger being asked to
            identify themselves before being told anything. Step 1 asks only what is broken.
          </li>
          <li>
            <b>Recording is the primary control.</b> <code>submit-request</code> accepts audio{' '}
            <em>instead of</em> a description (<code>if (!desc &amp;&amp; mediaItems.length === 0)</code>), so
            the UI offers it as a real alternative rather than a small mic on the corner of a textarea. Try
            recording and leaving the description empty — the form accepts it.
          </li>
          <li>
            <b>Name is marked required.</b> The live form leaves it unmarked, but the server returns{' '}
            <code>400 — Enter a valid name</code>. Clear step 2 and press the button to see the check fire
            before a round trip instead of after one.
          </li>
          <li>
            <b>The 20-character minimum is stated up front</b> and counts down as you type, instead of only
            appearing as a server error.
          </li>
          <li>
            <b>Phone and Best time say &ldquo;optional&rdquo;</b> rather than leaving it to a missing asterisk.
          </li>
          <li>
            <b>One cyan button per screen.</b> Login is a quiet link; the accent belongs to the one action that
            matters.
          </li>
        </ul>
      </section>
    </main>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  optional,
  type = 'text',
  error,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  optional?: boolean;
  type?: string;
  error?: string | null;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>
        {label}
        {optional && <em>optional</em>}
      </span>
      <input
        className={`${styles.input} ${error ? styles.inputErr : ''}`}
        value={value}
        type={type}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {error ? (
        <span className={styles.err}>
          <TriangleAlert size={14} />
          {error}
        </span>
      ) : (
        hint && <span className={styles.hint}>{hint}</span>
      )}
    </label>
  );
}

function Done({ name, email, onReset }: { name: string; email: string; onReset: () => void }) {
  return (
    <div className={styles.done}>
      <span className={styles.seal}>
        <Check size={22} />
      </span>
      <h1 className={styles.h1}>
        Got it, <em>{name.split(' ')[0] || 'thanks'}</em>
      </h1>
      <p className={styles.lead}>
        We are pricing it now. The quote lands at <b>{email}</b>, usually within the hour.
      </p>
      <p className={styles.hint}>
        Nothing was actually sent — this is a mockup. In the real flow this is where{' '}
        <code>submit-request</code> writes the request and emails you a confirmation.
      </p>
      <button type="button" className={styles.reset} onClick={onReset}>
        Start again
      </button>
    </div>
  );
}

function OldForm() {
  return (
    <div className={styles.old}>
      <p className={styles.oldCap}>Today — for comparison</p>
      <div className={styles.oldCard}>
        <p className={styles.oldKick}>— ELECTRICAL SERVICE</p>
        <h2 className={styles.oldH1}>
          Request a <em>QUOTE</em>
        </h2>
        <p className={styles.oldLead}>
          Describe your electrical issue and get an AI-drafted estimate in minutes.
        </p>
        <div className={styles.oldSteps}>
          <span className={styles.oldOn}>REQUEST</span>
          <span>QUOTE</span>
          <span>VISIT</span>
          <span>COMPLETE</span>
        </div>
        <div className={styles.oldGrid}>
          <span>
            <label>👤 NAME</label>
            <i>John Doe</i>
          </span>
          <span>
            <label>
              ✉️ EMAIL <b>*</b>
            </label>
            <i>john@example.com</i>
          </span>
          <span>
            <label>📞 NUMBER</label>
            <i>(555) 123-4567</i>
          </span>
          <span>
            <label>🕐 PREFFERED TIME</label>
            <i>Time picker</i>
          </span>
        </div>
        <label className={styles.oldFull}>
          🏠 ADDRESS <b>*</b>
        </label>
        <i className={styles.oldInput}>123 Electric Ave, London</i>
        <label className={styles.oldFull}>
          📄 JOB DESCRIPTION <b>*</b>
        </label>
        <i className={`${styles.oldInput} ${styles.oldTa}`}>What seems to be the problem? E.g., The consumer unit keeps tripping</i>
        <div className={styles.oldMedia}>
          <span>Add Images</span>
          <span>Voice Note</span>
        </div>
        <p className={styles.oldNote}>You may add upto 5 images &lt;10 Mbs or audio upto 20 Mb</p>
        <span className={styles.oldBtn}>GET INSTANT QUOTE</span>
      </div>
      <ul className={styles.oldFlags}>
        <li>Name and Number unmarked, but the server rejects an empty name</li>
        <li>No hint that the description needs 20 characters</li>
        <li>
          <code>PREFFERED</code>, <code>upto</code> twice, and <code>Time picker</code> left as a placeholder
        </li>
        <li>Two ways to record one voice note; the floating mic has no label</li>
        <li>Submit looks disabled and never says what is missing</li>
      </ul>
    </div>
  );
}
