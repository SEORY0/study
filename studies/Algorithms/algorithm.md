---
title: 알고리즘
short: 알고리즘
order: 2
summary: 알고리즘은 문제의 답을 구하는 단계별 절차이다
threads: []
date: 2026-10-20
---

## 1. 알고리즘이란
알고리즘은 문제의 답을 구하는 단계별 절차(step-by-step procedure)이다. 알고리즘의 목표는 유한한 시간과 공간을 효율적으로 쓰는 것이다.

## 2. 기본 용어
- Problem: 답을 찾고자 던지는 질문
- Parameter: Problem 속 변수
- Instance: Parameter에 특정 값을 넣은 것
- Algorithm: Problem의 모든 Instance에 대해 답을 내는 단계별 절차

## 3. 효율적인 알고리즘이 중요한 이유
같은 문제를 푸는 알고리즘이라도 효율에 따라 차이가 엄청나다. 예시로 같은 검색 문제를 푸는 순차검색과 이분검색을 비교해보겠다. 

이분검색(Binary Search)은 정렬된 배열에서 가운데 값과 x를 비교해서, x가 더 작으면 왼쪽 절반, 더 크면 오른쪽 절반만 남기고 다시 찾는 방법이다. 쉽게 말하면 매번 찾을 범위를 반으로 줄이는 것이다.
- 문제 : 크기가 n인 정렬된 배열 S에 x가 있는가?
- 입력 : 양수 n, 배열 S[1..n], 키 x
- 출력 : x의 위치. 없으면 0
```C
void binsearch(int n, const keytype S[], keytype x, index& location) {
  index low, high, mid;
  low = 1; high = n;
  location = 0;
  // 검사할 항목이 남아 있고, 아직 x를 못 찾았다면
  while (low <= high && location == 0) {
    mid = (low + high) / 2;          // 정수 나눗셈
    if (x == S[mid]) location = mid; // 찾음
    else if (x < S[mid]) high = mid - 1; // 왼쪽 절반만 남김
    else low = mid + 1;              // 오른쪽 절반만 남김
  }
}
```
while 문을 한 번 돈 때마다 검색 범위가 반으로 줄기 때문에, 최악의 경우라도 logn + 1개만 검사하면 된다. 여기서 log는 밑이 2인 로그다.

```ascii
 n             sequential (n)    binary (log n + 1)
 128                      128                     8
 1024                    1024                    11
 1048576              1048576                    21
 4294967296        4294967296                    33
```

그림. 배열 크기 n에 따른 최악의 경우 비교 횟수

그래서 배열이 약 43억 개면 순차검색은 43억 번, 이분검색은 33번만 비교한다. 알고리즘을 잘 고르는 것만으로 이 정도 차이가 난다.

## 4. 시간복잡도 분석
시간복잡도 분석은 입력 크기에 따라 단위 연산이 몇 번 수행되는지를 구하는 것이다.
- Input Size: 배열의 크기, 리스트의 길이, 행렬의 행과 열의 수 등의 입력의 크기
- Basic operation: 시간복잡도에 가장 크게 영향을 미치는 연산

알고리즘은 처음부터 끝까지 보면 여러 개의 연산이 붙어 있는데 그걸 다 더해서 세기에는 불편하다. 그래서 그 중 가장 영향력이 큰 연산 하나만 골라서 센다. 어차피 입력이 아주 커지면(asymptotic) 결국 그 연산이 가장 중요해지기 때문이다.

시간복잡도 분석은 다음과 같이 4가지 분석 방식이 있다.
- Every Case, T(n): 입력 값과 상관없이 항상 같은 횟수만큼 실행되는 경우, 입력 크기에만 종속됨
- Worst Case, W(n): Basic operation이 가장 많이 실행되는 입력을 기준으로 함
- Average Case, A(n): 모든 입력에 확률을 붙여서 단위연산 실행 횟수의 기대값(평균)을 구함
- Best Case, B(n): Basic operation이 가장 적게 실행되는 입력을 기준으로 함

이 넷 중에 신경 써야 할 것은 Worst와 Average 두 가지이다. Every Case는 알고리즘에 if문이 하나만 있어도 성립하지 않아서 잘 나오지 않고 Best Case는 운 좋은 경우가 실용적인 의미가 거의 없다.


## 이어지는 곳

