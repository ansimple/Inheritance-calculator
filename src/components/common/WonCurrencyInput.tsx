import React, { useState, useEffect } from 'react';

interface WonCurrencyInputProps {
  value: bigint;
  onChange: (value: bigint) => void;
  placeholder?: string;
  className?: string;
}

export const WonCurrencyInput: React.FC<WonCurrencyInputProps> = ({
  value,
  onChange,
  placeholder = '0',
  className = '',
}) => {
  const [text, setText] = useState<string>(value.toString());

  // 외부(상위 스토어, 시나리오 선택 등)에서 value가 변경되었을 때 텍스트 동기화
  useEffect(() => {
    const currentBigInt = text.trim() === '' ? 0n : BigInt(text.replace(/[^0-9]/g, '') || '0');
    if (currentBigInt !== value) {
      setText(value.toString());
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    
    // 완전히 비운 경우 빈 문자열 유지 (새로운 숫자를 입력하기 쉽도록)
    if (raw === '') {
      setText('');
      onChange(0n);
      return;
    }

    // '05' 처럼 '0' 뒤에 다른 숫자가 오면 앞의 '0' 제거, 단 '0' 단독 입력은 '0' 유지
    let cleaned = raw;
    if (cleaned.length > 1 && cleaned.startsWith('0')) {
      cleaned = BigInt(cleaned).toString();
    }

    setText(cleaned);
    onChange(BigInt(cleaned));
  };

  const handleBlur = () => {
    // 포커스를 잃었을 때 비어있다면 '0'으로 정리
    if (text.trim() === '') {
      setText('0');
      onChange(0n);
    }
  };

  return (
    <input
      type="text"
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
    />
  );
};
