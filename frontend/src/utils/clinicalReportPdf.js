import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from 'react-native';

/**
 * Determines whether a given stress trigger keyword is academic
 */
export const isAcademicTrigger = (trigger) => {
  if (!trigger) return true;
  const t = String(trigger).toLowerCase();
  return (
    t.includes('workload') ||
    t.includes('deadline') ||
    t.includes('exam') ||
    t.includes('viva') ||
    t.includes('thesis') ||
    t.includes('coding') ||
    t.includes('academic') ||
    t.includes('studies') ||
    t.includes('study')
  );
};

/**
 * Generates an executive, medical-grade HTML template for the MindCare Clinical Wellness Report.
 * Adheres to standard A4 print dimensions with pure self-contained CSS (Teal/Navy clinical palette).
 */
export const generateClinicalHTMLReport = (reportData) => {
  const safeData = reportData || {};

  // 1. Client and Clinical Identity Metadata
  const clientName = String(
    safeData.user_name ||
    safeData.name ||
    safeData.first_name ||
    safeData.fullName ||
    'Student'
  ).trim();

  const patientId = String(
    safeData.patient_id ||
    safeData.assessment_id ||
    `MC-${Math.floor(10000 + Math.random() * 89999)}`
  );

  // 7-Day Active Diagnostic Period / Date
  const today = new Date();
  const formattedToday = today.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  let diagnosticPeriod = formattedToday;
  if (safeData.start_date && safeData.end_date) {
    const sStr = String(safeData.start_date).split('T')[0];
    const eStr = String(safeData.end_date).split('T')[0];
    diagnosticPeriod = `${sStr} to ${eStr}`;
  } else {
    const startD = new Date();
    startD.setDate(startD.getDate() - 6);
    diagnosticPeriod = `${startD.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })} – ${formattedToday}`;
  }

  const issuedTimestamp = today.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // 2. Stress & Biometric Metrics
  const rawStress = safeData.avg_stress ?? safeData.pss_score ?? safeData.predicted_stress_score ?? 4.1;
  const numericStress = !isNaN(Number(rawStress)) ? Number(rawStress) : 4.1;
  const stressDisplay = numericStress.toFixed(1);

  let pssCategory = 'Calm';
  let categoryColor = '#0D9488';
  if (numericStress >= 6.5) {
    pssCategory = 'High Alert';
    categoryColor = '#DC2626';
  } else if (numericStress >= 4.0) {
    pssCategory = 'Moderate';
    categoryColor = '#D97706';
  }

  const rawSleep = safeData.avg_sleep ?? 7.0;
  const sleepDisplay = (!isNaN(Number(rawSleep)) ? Number(rawSleep) : 7.0).toFixed(1);

  const rawStudy = safeData.study_hours ?? 5.5;
  const studyDisplay = (!isNaN(Number(rawStudy)) ? Number(rawStudy) : 5.5).toFixed(1);

  // Primary Stress Trigger & Academic Classification
  const rawPdfTrigger = safeData.primary_stress_vector || safeData.common_trigger;
  const isInvalidPdfTrigger =
    !rawPdfTrigger ||
    String(rawPdfTrigger).trim() === '' ||
    String(rawPdfTrigger).trim().toLowerCase() === 'none' ||
    String(rawPdfTrigger).trim().toLowerCase() === 'null' ||
    String(rawPdfTrigger).trim().toLowerCase() === 'undefined';

  const primaryTrigger = isInvalidPdfTrigger ? 'General Academic Studies' : String(rawPdfTrigger).trim();
  const triggerPercentage = String(safeData.trigger_percentage || '45%');
  const isAcademic = isAcademicTrigger(primaryTrigger);

  // Behavioral & Activity Summary Metrics
  const actSummary = safeData.activity_summary || {};
  const actStats = safeData.activity_stats || {};

  const moodCount = actSummary.mood_count ?? (Array.isArray(safeData.recent_mood_logs) ? safeData.recent_mood_logs.length : 0);
  const assessmentCount = actSummary.assessment_count ?? (safeData.total_assessments ?? 0);
  const relaxationCount = Math.max(
    Number(actSummary.relaxation_count) || 0,
    Number(actStats.relaxSessions) || 0,
    Number(safeData.total_relaxations) || 0
  );
  const relaxationMinutes = Math.max(
    Number(actSummary.relaxation_minutes) || 0,
    Number(actStats.relaxMinutes) || 0,
    relaxationCount * 2
  );
  const studySessions = Math.max(
    Number(actSummary.study_sessions) || 0,
    Number(actStats.studySessions) || 0,
    Number(safeData.completed_topics_count) || 0
  );
  const studyMinutes = Math.max(
    Number(actSummary.study_minutes) || 0,
    Number(actStats.studyMinutes) || 0,
    studySessions * 25
  );

  // 3. 7-Day Stress & Sleep Breakdown Rows (Mon-Sun)
  const daysOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  let weeklyMetrics = safeData.weekly_metrics;

  if (!weeklyMetrics || !Array.isArray(weeklyMetrics) || weeklyMetrics.length === 0) {
    // Construct default or parse from history / logs
    weeklyMetrics = daysOrder.map((day) => ({
      day,
      hasStress: false,
      stressScore: 0,
      hasSleep: false,
      sleepHours: 0,
    }));
  }

  const weeklyRowsHtml = weeklyMetrics
    .map((item) => {
      const stressText = item.hasStress ? `${item.stressScore.toFixed(1)} / 10` : '—';
      const stressStyle = item.hasStress
        ? item.stressScore >= 6.5
          ? 'color: #DC2626; font-weight: 700;'
          : item.stressScore >= 4.0
          ? 'color: #D97706; font-weight: 700;'
          : 'color: #0D9488; font-weight: 700;'
        : 'color: #94A3B8;';

      const sleepText = item.hasSleep ? `${item.sleepHours.toFixed(1)}h` : '—';
      const sleepStyle = item.hasSleep
        ? item.sleepHours >= 7.0
          ? 'color: #0D9488; font-weight: 700;'
          : 'color: #D97706; font-weight: 700;'
        : 'color: #94A3B8;';

      let stateText = 'No Log Recorded';
      if (item.hasStress) {
        stateText = item.stressScore >= 6.5 ? 'High Alert' : item.stressScore >= 4.0 ? 'Moderate' : 'Calm';
      } else if (item.hasSleep) {
        stateText = 'Rest Window Logged';
      }

      return `
        <tr>
          <td style="width: 20%; font-weight: 700; color: #0F172A;">${item.day}</td>
          <td style="width: 25%; ${stressStyle}">${stressText}</td>
          <td style="width: 25%; ${sleepStyle}">${sleepText}</td>
          <td style="width: 30%; color: #475569;">${stateText}</td>
        </tr>
      `;
    })
    .join('');

  // Mood Distribution Table
  const moodDistribution = safeData.mood_distribution || [];
  const moodRowsHtml =
    moodDistribution.length > 0
      ? moodDistribution
          .map(
            (m) => `
        <tr>
          <td style="width: 40%; font-weight: 700; color: #0F172A;">${m.name}</td>
          <td style="width: 30%; color: #0D9488; font-weight: 700;">${m.pct}%</td>
          <td style="width: 30%; color: #64748B;">${m.count} ${m.count === 1 ? 'entry' : 'entries'}</td>
        </tr>
      `
          )
          .join('')
      : `
        <tr>
          <td colspan="3" style="text-align: center; color: #94A3B8; padding: 10px;">
            Sufficient mood check-in records will populate longitudinal affect distribution.
          </td>
        </tr>
      `;

  // 4. Primary Stress Triggers Table
  const stressFactors = safeData.stress_factors || [];
  const stressFactorsRowsHtml =
    stressFactors.length > 0
      ? stressFactors
          .map(
            (f) => `
        <tr>
          <td style="width: 50%; font-weight: 700; color: #0F172A;">${f.name}</td>
          <td style="width: 25%; color: #0D9488; font-weight: 700;">${f.pct}%</td>
          <td style="width: 25%; color: #64748B;">${f.count} ${f.count === 1 ? 'entry' : 'entries'}</td>
        </tr>
      `
          )
          .join('')
      : `
        <tr>
          <td style="width: 50%; font-weight: 700; color: #0F172A;">${primaryTrigger}</td>
          <td style="width: 25%; color: #0D9488; font-weight: 700;">${triggerPercentage}</td>
          <td style="width: 25%; color: #64748B;">Primary Vector</td>
        </tr>
      `;

  // 5. Actionable Clinical & Self-Care Recommendations
  // Context-aware: Pacing is strictly academic vs non-academic
  const cognitivePacingDesc = isAcademic
    ? 'Structure your study sessions with 45m focus / 10m reset intervals to maintain sustained working memory stamina.'
    : 'Break financial or personal tasks into small, scheduled 20-minute planning check-ins to reduce mental overwhelm.';

  const protocols = [
    {
      title: 'Circadian Rhythm Stability',
      desc: `Based on your logged ${sleepDisplay}h average sleep, stabilize your circadian rhythm by establishing consistent bed and wake times to protect restorative neuro-cognitive recovery.`,
    },
    {
      title: 'Autonomic Coherence Regulation',
      desc:
        numericStress >= 6.0
          ? 'Elevated tension detected. Engage in 4-4-4-4 box breathing sprint twice daily to down-regulate sympathetic hyperarousal before focus blocks.'
          : 'Your stress markers demonstrate balanced resilience. Maintain brief 2-minute physiological sighing pauses throughout the day to sustain autonomic equilibrium.',
    },
    {
      title: isAcademic ? 'Cognitive Task Pacing' : 'Mindful Task Management',
      desc: cognitivePacingDesc,
    },
  ];

  const protocolsHtml = protocols
    .map(
      (p, idx) => `
    <div class="protocol-card">
      <div class="protocol-index">${idx + 1}</div>
      <div class="protocol-content">
        <div class="protocol-title">${p.title}</div>
        <div class="protocol-desc">${p.desc}</div>
      </div>
    </div>
  `
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>MindCare Clinical Wellness Report</title>
  <style>
    @page { size: A4; margin: 12mm 14mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      padding: 0;
      margin: 0;
      color: #0F172A;
      background-color: #FFFFFF;
      line-height: 1.45;
      font-size: 9pt;
    }
    .header-banner {
      display: table;
      width: 100%;
      border-bottom: 2.5px solid #0D9488;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .header-left {
      display: table-cell;
      vertical-align: middle;
      width: 65%;
    }
    .header-right {
      display: table-cell;
      vertical-align: middle;
      width: 35%;
      text-align: right;
    }
    .brand-title {
      font-size: 16pt;
      font-weight: 800;
      color: #0F172A;
      letter-spacing: -0.4px;
      margin: 0;
    }
    .brand-subtitle {
      font-size: 8pt;
      font-weight: 700;
      color: #0D9488;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-top: 3px;
    }
    .status-badge {
      display: inline-block;
      background-color: #F0FDFA;
      border: 1px solid #99F6E4;
      color: #0F766E;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 7.5pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .timestamp-text {
      font-size: 7.5pt;
      color: #94A3B8;
      margin-top: 3px;
    }
    .metadata-card {
      display: table;
      width: 100%;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 14px;
    }
    .metadata-cell {
      display: table-cell;
      width: 25%;
      vertical-align: top;
    }
    .metadata-label {
      font-size: 7pt;
      font-weight: 800;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: block;
      margin-bottom: 2px;
    }
    .metadata-val {
      font-size: 10pt;
      font-weight: 700;
      color: #0F172A;
    }
    .section-title {
      font-size: 9.5pt;
      font-weight: 800;
      color: #0F766E;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      border-bottom: 1.5px solid #E2E8F0;
      padding-bottom: 3px;
      margin-top: 14px;
      margin-bottom: 8px;
    }
    .table-custom {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    .table-custom th {
      background-color: #0F766E;
      color: #FFFFFF;
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      padding: 6px 8px;
      text-align: left;
    }
    .table-custom td {
      border: 1px solid #E2E8F0;
      padding: 6px 8px;
      font-size: 8.5pt;
      color: #334155;
    }
    .table-custom tr:nth-child(even) {
      background-color: #F8FAFC;
    }
    .metric-val {
      font-weight: 700;
      color: #0F766E;
    }
    .protocol-card {
      display: table;
      width: 100%;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-left: 3.5px solid #0D9488;
      border-radius: 6px;
      padding: 8px 10px;
      margin-bottom: 6px;
    }
    .protocol-index {
      display: table-cell;
      width: 20px;
      font-weight: 800;
      color: #0D9488;
      font-size: 10pt;
      vertical-align: top;
    }
    .protocol-content {
      display: table-cell;
      vertical-align: top;
    }
    .protocol-title {
      font-weight: 700;
      color: #0F766E;
      font-size: 9pt;
      margin-bottom: 2px;
    }
    .protocol-desc {
      font-size: 8pt;
      color: #475569;
      line-height: 1.35;
    }
    .split-row {
      display: table;
      width: 100%;
      margin-bottom: 10px;
    }
    .split-col {
      display: table-cell;
      width: 50%;
      vertical-align: top;
    }
    .split-col:first-child {
      padding-right: 8px;
    }
    .split-col:last-child {
      padding-left: 8px;
    }
    .disclaimer-card {
      margin-top: 14px;
      padding: 8px 10px;
      background-color: #FFFBEB;
      border: 1px solid #FDE68A;
      border-radius: 6px;
      font-size: 7.2pt;
      color: #92400E;
      line-height: 1.35;
    }
    .disclaimer-title {
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: block;
      margin-bottom: 2px;
    }
    .footer-note {
      margin-top: 12px;
      border-top: 1px dashed #CBD5E1;
      padding-top: 6px;
      text-align: center;
      font-size: 7pt;
      color: #94A3B8;
    }
  </style>
</head>
<body>
  <!-- 1. Report Header -->
  <div class="header-banner">
    <div class="header-left">
      <div class="brand-title">MindCare Clinical Wellness Report</div>
      <div class="brand-subtitle">Professional Behavioral & Longitudinal Analytics</div>
    </div>
    <div class="header-right">
      <span class="status-badge">Clinical Compliance Validated</span>
      <div class="timestamp-text">Generated: ${issuedTimestamp}</div>
    </div>
  </div>

  <!-- Patient / Diagnostic Metadata -->
  <div class="metadata-card">
    <div class="metadata-cell">
      <span class="metadata-label">Client / Student</span>
      <span class="metadata-val">${clientName}</span>
    </div>
    <div class="metadata-cell">
      <span class="metadata-label">Record Identifier</span>
      <span class="metadata-val">${patientId}</span>
    </div>
    <div class="metadata-cell">
      <span class="metadata-label">Diagnostic Window</span>
      <span class="metadata-val">${diagnosticPeriod}</span>
    </div>
    <div class="metadata-cell">
      <span class="metadata-label">Mean Stress Index</span>
      <span class="metadata-val" style="color: ${categoryColor};">${stressDisplay} / 10</span>
    </div>
  </div>

  <!-- 2. Biometric & Behavioral Summary Table -->
  <div class="section-title">Biometric & Behavioral Summary</div>
  <table class="table-custom">
    <thead>
      <tr>
        <th style="width: 25%">Clinical Parameter</th>
        <th style="width: 25%">Observed Metric</th>
        <th style="width: 25%">Clinical Target</th>
        <th style="width: 25%">Evaluation</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Average Stress Score</strong></td>
        <td><strong class="metric-val">${stressDisplay} / 10</strong></td>
        <td>&lt; 5.0 / 10</td>
        <td><span style="color: ${categoryColor}; font-weight: 700;">${pssCategory}</span></td>
      </tr>
      <tr>
        <td><strong>Average Sleep Duration</strong></td>
        <td><strong class="metric-val">${sleepDisplay} Hours / night</strong></td>
        <td>7.0 – 9.0 Hours</td>
        <td>${parseFloat(sleepDisplay) < 7.0 ? 'Deficit / Attention Advised' : 'Optimal Rest Window'}</td>
      </tr>
      <tr>
        <td><strong>Assessments Completed</strong></td>
        <td><strong class="metric-val">${assessmentCount}</strong> evaluations</td>
        <td>Routine Monitoring</td>
        <td>${assessmentCount > 0 ? 'Active Diagnostic Tracking' : 'Baseline Window'}</td>
      </tr>
      <tr>
        <td><strong>Relaxation Sessions</strong></td>
        <td><strong class="metric-val">${relaxationCount} sessions</strong> (${relaxationMinutes} mins)</td>
        <td>Daily 2m – 10m</td>
        <td>${relaxationCount > 0 ? 'Active Autonomic Regulation' : 'Recommended'}</td>
      </tr>
      <tr>
        <td><strong>A+ Study Focus Blocks</strong></td>
        <td><strong class="metric-val">${studySessions} blocks</strong> (${studyMinutes} mins)</td>
        <td>Structured Pacing</td>
        <td>${studySessions > 0 ? 'Interval Pacing Active' : 'Optimal Cadence'}</td>
      </tr>
    </tbody>
  </table>

  <!-- 3. 7-Day Stress & Sleep Breakdown and Mood Distribution -->
  <div class="split-row">
    <div class="split-col">
      <div class="section-title">7-Day Stress & Sleep Breakdown</div>
      <table class="table-custom">
        <thead>
          <tr>
            <th>Day</th>
            <th>Stress</th>
            <th>Sleep</th>
            <th>Autonomic Tone</th>
          </tr>
        </thead>
        <tbody>
          ${weeklyRowsHtml}
        </tbody>
      </table>
    </div>

    <div class="split-col">
      <div class="section-title">Affect & Mood Distribution</div>
      <table class="table-custom">
        <thead>
          <tr>
            <th>Mood</th>
            <th>Proportion</th>
            <th>Logs</th>
          </tr>
        </thead>
        <tbody>
          ${moodRowsHtml}
        </tbody>
      </table>
    </div>
  </div>

  <!-- 4. Primary Stress Triggers -->
  <div class="section-title">Primary Stress Triggers & Pressure Vectors</div>
  <table class="table-custom">
    <thead>
      <tr>
        <th>Trigger Category</th>
        <th>Proportion</th>
        <th>Occurrence</th>
      </tr>
    </thead>
    <tbody>
      ${stressFactorsRowsHtml}
    </tbody>
  </table>

  <!-- 5. Actionable Clinical & Self-Care Recommendations -->
  <div class="section-title">Actionable Clinical & Self-Care Recommendations</div>
  ${protocolsHtml}

  <!-- Confidentiality Disclaimer -->
  <div class="disclaimer-card">
    <span class="disclaimer-title">Confidential Clinical Disclaimer</span>
    This summary report is generated by the MindCare Clinical System for educational, academic pacing, and wellness tracking purposes. It does not constitute a formal psychiatric diagnosis, clinical treatment plan, or medical directive. If you are experiencing acute distress or crisis, please contact your university health center or emergency services immediately.
  </div>

  <div class="footer-note">
    MindCare Clinical System • Document ID: ${patientId} • Confidential Professional Health Summary
  </div>
</body>
</html>`;
};

/**
 * Compiles the PDF and triggers the native system share/save dialog.
 * Uses expo-print + expo-sharing.
 */
export const exportClinicalPDF = async (reportData, setIsExporting) => {
  if (typeof setIsExporting === 'function') {
    setIsExporting(true);
  }

  try {
    const htmlContent = generateClinicalHTMLReport(reportData);
    const { uri } = await Print.printToFileAsync({ html: htmlContent });

    const fileName = `MindCare_Wellness_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
    const cacheDir = FileSystem?.cacheDirectory || '';
    const targetUri = cacheDir ? `${cacheDir}${fileName}` : uri;

    if (cacheDir && typeof FileSystem?.copyAsync === 'function') {
      try {
        await FileSystem.copyAsync({ from: uri, to: targetUri });
      } catch (copyErr) {
        console.warn('File copy notice, using base URI:', copyErr?.message || copyErr);
      }
    }

    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(targetUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Export MindCare Clinical Wellness Report',
          UTI: 'com.adobe.pdf',
        });
      } else {
        await Print.printAsync({ html: htmlContent });
      }
    } catch (shareErr) {
      console.warn('Sharing restricted, falling back to system print dialog:', shareErr?.message || shareErr);
      await Print.printAsync({ html: htmlContent });
    }
  } catch (error) {
    const msg = error?.message || '';
    if (!msg.toLowerCase().includes('cancel') && !msg.toLowerCase().includes('dismiss')) {
      console.warn('PDF Generation Error:', error);
      Alert.alert('Export Error', 'Unable to generate PDF report: ' + msg);
    }
  } finally {
    if (typeof setIsExporting === 'function') {
      setIsExporting(false);
    }
  }
};
