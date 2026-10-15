---
title: 소신호 모델
short: 소신호 모델
order: 1
summary: 동작점 근처에서 곡선을 접선으로 바꾸면 트랜지스터는 기울기 하나로 움직이는 선형 증폭기가 된다
threads: [lin]
date: 2026-10-15
---

트랜지스터는 비선형 소자다. MOSFET의 드레인 전류는 게이트 전압의 제곱으로 변하니 이대로는 중첩의 원리도 테브난 등가도 쓸 수 없다. 그런데 직류 바이어스로 동작점(Q-point)을 하나 잡고 그 근처에서만 작게 흔들면 곡선은 접선과 구별되지 않는다. 그 접선의 기울기가 트랜스컨덕턴스(transconductance) g<sub>m</sub>이고, 트랜지스터를 g<sub>m</sub> 하나짜리 선형 소자로 바꿔 그린 회로가 소신호 모델(small-signal model)이다.

## 제곱법칙과 접선

첨자의 대소문자로 세 가지를 구분한다. 전체 값 v<sub>GS</sub>, 바이어스 V<sub>GS</sub>, 신호 v<sub>gs</sub>이고 v<sub>GS</sub> = V<sub>GS</sub> + v<sub>gs</sub>다. 포화 영역(v<sub>DS</sub> ≥ v<sub>GS</sub> − V<sub>t</sub>)의 NMOS는 채널 길이 변조를 무시하면 제곱법칙을 따른다.

```eq
i_D = (k/2)·(v_GS − V_t)²,     k = μ_n·C_ox·(W/L)
```

오버드라이브 V<sub>OV</sub> = V<sub>GS</sub> − V<sub>t</sub>를 넣고 전개하면 정확히 세 항으로 끝난다.

```eq
i_D = (k/2)·V_OV² + k·V_OV·v_gs + (k/2)·v_gs²
      └────┬────┘   └────┬────┘   └────┬────┘
          I_D         g_m·v_gs     distortion
```

첫 항은 바이어스 전류, 둘째 항이 신호에 비례하는 선형 성분, 셋째 항이 왜곡이다. 셋째 항을 둘째 항으로 나누면 정확히 v<sub>gs</sub>/(2V<sub>OV</sub>)이므로 "소신호"의 정확한 뜻은 v<sub>gs</sub> ≪ 2V<sub>OV</sub>다. 작다는 기준이 절대 크기가 아니라 바이어스가 정한 길이라는 점이 핵심이다. 선형 성분의 계수는 동작점에서 잰 미분이다.

```eq
        ∂i_D  │      2·I_D
g_m  =  ───── │  =   ─────  =  k·V_OV
        ∂v_GS │Q      V_OV
```

```ascii
  i_D
     ▲
     │                  /   i_D = (k/2)(v_GS − V_t)²
     │                 /  . tangent: slope g_m
     │                / .'
     │               /.'
     │              /'
     │            .'
 I_D ┼┄┄┄┄┄┄┄┄┄┄●'
     │        .'┆ Q
     │   ...-'  ┆
     └──┬───────┼───────────▶ v_GS
       V_t     V_GS
```

그림. V<sub>t</sub> = 0.5 V, Q = (0.7 V, 0.5 mA)에 맞춘 눈금. Q 근처에서는 곡선과 접선이 같은 글자에 겹치고, 멀어질수록 곡선이 접선 위로 휜다

## 숫자 하나

V<sub>t</sub> = 0.5 V인 NMOS를 V<sub>GS</sub> = 0.7 V로 바이어스해 I<sub>D</sub> = 0.5 mA가 흐른다고 하자. V<sub>OV</sub> = 0.2 V다.

- k = 2I<sub>D</sub>/V<sub>OV</sub><sup>2</sup> = 25 mA/V<sup>2</sup>
- g<sub>m</sub> = 2 × 0.5 mA / 0.2 V = 5 mA/V, 곧 5 mS
- 게이트를 10 mV 흔들면 i<sub>d</sub>는 50 µA이고 왜곡 항은 그 2.5 %인 1.25 µA
- 100 mV를 넣으면 +100 mV에서 +625 µA, −100 mV에서 −375 µA. 위아래가 25 %씩 어긋나니 더 이상 소신호가 아니다

BJT도 같은 틀에 들어간다. i<sub>C</sub> = I<sub>S</sub>·e<sup>v<sub>BE</sub>/V<sub>T</sub></sup>를 동작점에서 전개하면 2차 항과 1차 항의 비가 v<sub>be</sub>/(2V<sub>T</sub>)이고, g<sub>m</sub> = I<sub>C</sub>/V<sub>T</sub>다. 열전압 V<sub>T</sub>는 상온에서 약 25.9 mV라, 같은 0.5 mA에서 g<sub>m</sub> ≈ 19 mS로 MOSFET의 네 배 가까이 된다. 대신 선형으로 볼 수 있는 기준 길이는 2V<sub>T</sub> ≈ 52 mV로, 위 MOSFET의 2V<sub>OV</sub> = 0.4 V보다 훨씬 짧다. 곡선의 모양만 다를 뿐 "접선을 긋고, 접선이 버티는 범위 안에서만 쓴다"는 절차는 똑같다.

이 트랜지스터에 R<sub>D</sub> = 4 kΩ, V<sub>DD</sub> = 5 V를 달면 공통 소스(common-source) 증폭기다. 직류로는 V<sub>DS</sub> = 5 V − 0.5 mA × 4 kΩ = 3 V라 포화가 유지된다. 소신호 등가회로에서는 직류 전원이 모두 꺼진다. V<sub>DD</sub>는 교류 접지가 되고, 게이트로는 전류가 들어가지 않으며, 드레인과 소스 사이에 종속 전류원 g<sub>m</sub>v<sub>gs</sub> 하나가 남는다.

```ascii
 v_i   g               d                v_o
  ●────●         ┌─────●──────────┬──────●
                 │                │
       +        /↓\              ┌┴┐
      v_gs      \ /  g_m·v_gs    │ │ R_D
       −         │               └┬┘
                 │                │
  ●────●─────────┴────────────────┴──────●
       s                                0 V
```

그림. 공통 소스 증폭기의 소신호 등가회로. 게이트는 열려 있고 V<sub>DD</sub>와 소스는 교류 접지다

드레인 노드의 KCL: 전류원이 g<sub>m</sub>v<sub>gs</sub>를 끌어내리니 R<sub>D</sub>에는 같은 전류가 접지에서 드레인 쪽으로 흐르고 v<sub>o</sub> = −g<sub>m</sub>R<sub>D</sub>·v<sub>i</sub>다. A<sub>v</sub> = −5 mS × 4 kΩ = −20. 음의 부호는 전류가 늘면 R<sub>D</sub>의 전압강하가 커져 드레인 전압이 내려간다는 뜻이다. 10 mV 입력은 200 mV 출력이 되고, 드레인은 3 V를 중심으로 ±0.2 V만 움직이니 포화 조건도 그대로다.

## 단을 이으면

출력 쪽에서 보면 공통 소스단은 전압원 −g<sub>m</sub>R<sub>D</sub>·v<sub>i</sub> 뒤에 R<sub>D</sub>가 직렬로 붙은 회로다. 부하 R<sub>L</sub>을 달면 분압 때문에 이득이 −g<sub>m</sub>(R<sub>D</sub>∥R<sub>L</sub>)로 줄어든다. 반면 다음 단의 입력이 MOSFET 게이트면 입력 저항이 사실상 무한대라 앞단을 깎지 않는다. 그래서 첫 단은 −20 그대로이고, R<sub>L</sub> = 4 kΩ을 단 둘째 단은 −5 mS × 2 kΩ = −10이다.

```ascii
          ┌─────┐       ┌─────┐
 v_i ────▶│ −20 ├──────▶│ −10 ├────▶ v_o
          └─────┘  v₁   └─────┘
          dv₁/dv_i      dv_o/dv₁
 dv_o/dv_i = (−20)·(−10) = 200   (46 dB)
```

그림. 2단 증폭기. 단마다 이득은 그 단의 국소 기울기이고 전체 이득은 그 곱이다

## 이어지는 곳

선형화 줄에서 앞 역은 [테브난 등가](/study/thevenin/)다. 테브난 등가와 중첩은 선형 회로에서만 성립하고, 소신호 모델은 트랜지스터 회로를 그 조건 안으로 들여보내는 장치다. 직류 해석과 소신호 해석을 따로 풀어 더하는 것 자체가 중첩이고, 등가회로에서 V<sub>DD</sub>를 접지로 바꾸는 것은 중첩에서 전압원을 단락하는 규칙 그대로다. 부하 효과도 같은 도구로 풀린다. 출력단을 V<sub>th</sub> = −g<sub>m</sub>R<sub>D</sub>·v<sub>i</sub>, R<sub>th</sub> = R<sub>D</sub>로 바꿔 놓으면 R<sub>L</sub>과의 분압 R<sub>L</sub>/(R<sub>D</sub> + R<sub>L</sub>) = 1/2이 −20을 −10으로 만든다. 더 거슬러 올라가면 출발점은 [선형 시불변 시스템](/study/lti/)의 중첩이다.

다음 역은 [역전파](/study/backprop/)다. g<sub>m</sub> = ∂i<sub>D</sub>/∂v<sub>GS</sub>는 동작점에서 잰 국소 미분이고, 단을 이으면 전체 이득이 단별 이득의 곱 dv<sub>o</sub>/dv<sub>i</sub> = (dv<sub>o</sub>/dv<sub>1</sub>)·(dv<sub>1</sub>/dv<sub>i</sub>)가 된다. 연쇄법칙과 글자 하나 다르지 않다. 겹치는 점이 두 가지 더 있다.

- 국소 기울기는 어디서 재느냐에 달려 있다. g<sub>m</sub> = 2I<sub>D</sub>/V<sub>OV</sub>는 직류 해석으로 I<sub>D</sub>를 구한 뒤에야 정해진다. 역전파가 순전파 값을 먼저 저장해 두는 이유와 같다.
- 기울기의 곱은 단 수에 대해 지수적이다. 이득 0.5짜리 10단은 1/1024, 이득 2짜리 10단은 1024다. 신경망에서는 이것을 기울기 소실과 폭주라고 부른다.
