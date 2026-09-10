import { ArrowDownToLine } from 'lucide-react';
import { Button } from './ui/button';
import { createRecordsCsv } from '../lib/records-csv';
import type { Record as IssRecord } from '../lib/readings';

export function RecordCsvDownload({ records }: { records: readonly IssRecord[] }) {
  const empty = records.length === 0;
  function download() {
    if (empty) return;
    const blob = new Blob([createRecordsCsv(records)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'orbit-iss-records.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="record-export">
    <Button type="button" className="secondary-button" onClick={download} disabled={empty} aria-describedby="record-export-description">
      <ArrowDownToLine size={15} />관측 기록 CSV 다운로드
    </Button>
    <p id="record-export-description">{empty ? '내려받을 관측 기록이 없습니다.' : '공개 보존 기록을 원본 정밀도의 표로 저장합니다.'}</p>
  </div>;
}
