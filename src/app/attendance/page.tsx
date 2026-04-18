export default function AttendancePage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      textAlign: 'center',
      padding: '2rem'
    }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
        출석 기능 점검 중
      </h1>
      <p style={{ color: '#888' }}>출석 기능이 잠시 점검 중입니다.</p>
      <p style={{ color: '#888' }}>곧 재개될 예정이니 조금만 기다려 주세요.</p>
    </div>
  );
}
