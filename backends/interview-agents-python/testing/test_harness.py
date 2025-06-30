"""
Automated Testing Framework for AI Agents.
Provides comprehensive testing infrastructure for prompt evolution and agent performance.
Ported from TypeScript implementation in src/testing/test-harness.ts
"""

import asyncio
import time
import json
import logging
from typing import Dict, Any, List, Optional, Callable, Union
from enum import Enum
from dataclasses import dataclass, field
from datetime import datetime
from abc import ABC, abstractmethod

from ..common.config import AgentName, ComplexityLevel
from ..common.telemetry import record_agent_metrics, calculate_operation_cost

logger = logging.getLogger(__name__)


class TestCategory(str, Enum):
    """Test categories."""
    UNIT = "unit"
    INTEGRATION = "integration"
    E2E = "e2e"
    PERFORMANCE = "performance"
    ADVERSARIAL = "adversarial"


class ValidationRuleType(str, Enum):
    """Validation rule types."""
    EXACT_MATCH = "exact_match"
    FUZZY_MATCH = "fuzzy_match"
    SCHEMA_MATCH = "schema_match"
    CUSTOM_RULE = "custom_rule"


class TestPriority(str, Enum):
    """Test priority levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class ValidationRule:
    """Validation rule for test cases."""
    type: ValidationRuleType
    threshold: Optional[float] = None
    validator: Optional[Callable[[Any, Any], bool]] = None


@dataclass
class TestMetadata:
    """Test metadata."""
    created_at: datetime
    created_by: str
    tags: List[str] = field(default_factory=list)
    priority: TestPriority = TestPriority.MEDIUM


@dataclass
class TestCase:
    """Test case definition - matches TypeScript TestCase."""
    id: str
    name: str
    description: str
    complexity: str  # LOW, MEDIUM, HIGH
    category: TestCategory
    
    input: Any
    expected_output: Optional[Any] = None
    validation_rules: List[ValidationRule] = field(default_factory=list)
    
    timeout: int = 30000  # milliseconds
    retries: int = 0
    
    metadata: TestMetadata = field(default_factory=lambda: TestMetadata(
        created_at=datetime.now(),
        created_by="system"
    ))


@dataclass
class TestPerformance:
    """Test performance metrics."""
    latency: float  # milliseconds
    tokens_used: int
    cost: float


@dataclass
class TestAccuracy:
    """Test accuracy metrics."""
    score: float  # 0.0 to 1.0
    errors: List[str] = field(default_factory=list)


@dataclass
class TestResultMetadata:
    """Test result metadata."""
    start_time: datetime
    end_time: datetime
    environment: str
    agent_version: str


@dataclass
class TestResult:
    """Test result - matches TypeScript TestResult."""
    test_case_id: str
    passed: bool
    
    performance: TestPerformance
    accuracy: Optional[TestAccuracy] = None
    
    output: Optional[Any] = None
    error: Optional[str] = None
    error_type: Optional[str] = None
    
    metadata: TestResultMetadata = field(default_factory=lambda: TestResultMetadata(
        start_time=datetime.now(),
        end_time=datetime.now(),
        environment="development",
        agent_version="1.0.0"
    ))


@dataclass
class TestSuiteConfig:
    """Test suite configuration."""
    parallel: bool = False
    max_concurrency: int = 5
    stop_on_first_failure: bool = False
    report_format: str = "json"  # json, html, markdown


@dataclass
class TestSuite:
    """Test suite definition - matches TypeScript TestSuite."""
    id: str
    name: str
    description: str
    agent_name: AgentName
    
    test_cases: List[TestCase]
    configuration: TestSuiteConfig = field(default_factory=TestSuiteConfig)


@dataclass
class TestSummary:
    """Test suite summary."""
    total: int
    passed: int
    failed: int
    pass_rate: float
    avg_latency: float
    total_cost: float


class AgentTestHarness:
    """Agent Test Harness - Executes tests against individual agents."""
    
    def __init__(
        self,
        agent_name: AgentName,
        agent_function: Callable,
        config: Optional[Dict[str, Any]] = None
    ):
        self.agent_name = agent_name
        self.agent_function = agent_function
        
        default_config = {
            "timeout": 30000,
            "retries": 3,
            "record_metrics": True
        }
        self.config = {**default_config, **(config or {})}
    
    async def run_test(self, test_case: TestCase) -> TestResult:
        """Run a single test case."""
        start_time = datetime.now()
        attempts = 0
        last_error: Optional[Exception] = None
        
        while attempts <= self.config["retries"]:
            attempts += 1
            
            try:
                result = await self._execute_test_case(test_case, start_time)
                
                if self.config["record_metrics"]:
                    record_agent_metrics(
                        self.agent_name,
                        'test_execution',
                        {
                            "latency": result.performance.latency,
                            "tokensUsed": result.performance.tokens_used,
                            "cost": result.performance.cost,
                            "success": result.passed
                        }
                    )
                
                return result
                
            except Exception as error:
                last_error = error
                
                if attempts <= self.config["retries"]:
                    logger.warning(
                        f"Test {test_case.id} failed, retrying "
                        f"(attempt {attempts}/{self.config['retries'] + 1})"
                    )
                    await asyncio.sleep(min(2 ** attempts, 10))  # Exponential backoff
        
        # All retries exhausted
        end_time = datetime.now()
        return TestResult(
            test_case_id=test_case.id,
            passed=False,
            performance=TestPerformance(
                latency=(end_time - start_time).total_seconds() * 1000,
                tokens_used=0,
                cost=0.0
            ),
            error=str(last_error) if last_error else "Unknown error",
            error_type=last_error.__class__.__name__ if last_error else "UnknownError",
            metadata=TestResultMetadata(
                start_time=start_time,
                end_time=end_time,
                environment="development",
                agent_version="1.0.0"
            )
        )
    
    async def _execute_test_case(
        self,
        test_case: TestCase,
        start_time: datetime
    ) -> TestResult:
        """Execute a single test case."""
        timeout_ms = test_case.timeout or self.config["timeout"]
        
        # Execute with timeout
        execution_start = time.time()
        
        try:
            if asyncio.iscoroutinefunction(self.agent_function):
                output = await asyncio.wait_for(
                    self.agent_function(test_case.input),
                    timeout=timeout_ms / 1000.0
                )
            else:
                # Run sync function in executor
                loop = asyncio.get_event_loop()
                output = await asyncio.wait_for(
                    loop.run_in_executor(None, self.agent_function, test_case.input),
                    timeout=timeout_ms / 1000.0
                )
        except asyncio.TimeoutError:
            raise Exception(f"Test timed out after {timeout_ms}ms")
        
        latency = (time.time() - execution_start) * 1000  # Convert to ms
        
        # Validate output
        validation = await self._validate_output(
            output,
            test_case.expected_output,
            test_case.validation_rules
        )
        
        # Calculate metrics
        tokens_used = self._extract_token_usage(output)
        cost = calculate_operation_cost(tokens_used)
        
        return TestResult(
            test_case_id=test_case.id,
            passed=validation["passed"],
            
            performance=TestPerformance(
                latency=latency,
                tokens_used=tokens_used,
                cost=cost
            ),
            
            accuracy=TestAccuracy(
                score=validation["score"],
                errors=validation["errors"]
            ),
            
            output=output,
            
            metadata=TestResultMetadata(
                start_time=start_time,
                end_time=datetime.now(),
                environment="development",
                agent_version="1.0.0"
            )
        )
    
    async def _validate_output(
        self,
        actual: Any,
        expected: Any,
        rules: List[ValidationRule]
    ) -> Dict[str, Any]:
        """Validate test output."""
        if not rules:
            # Default validation - exact match
            passed = json.dumps(actual, sort_keys=True) == json.dumps(expected, sort_keys=True)
            return {
                "passed": passed,
                "score": 1.0 if passed else 0.0,
                "errors": [] if passed else ["Output does not match expected result"]
            }
        
        results: List[bool] = []
        errors: List[str] = []
        
        for rule in rules:
            try:
                rule_result = False
                
                if rule.type == ValidationRuleType.EXACT_MATCH:
                    rule_result = json.dumps(actual, sort_keys=True) == json.dumps(expected, sort_keys=True)
                
                elif rule.type == ValidationRuleType.FUZZY_MATCH:
                    similarity = self._calculate_similarity(actual, expected)
                    rule_result = similarity >= (rule.threshold or 0.8)
                
                elif rule.type == ValidationRuleType.SCHEMA_MATCH:
                    rule_result = self._validate_schema(actual, expected)
                
                elif rule.type == ValidationRuleType.CUSTOM_RULE:
                    if rule.validator:
                        if asyncio.iscoroutinefunction(rule.validator):
                            rule_result = await rule.validator(actual, expected)
                        else:
                            rule_result = rule.validator(actual, expected)
                
                results.append(rule_result)
                
                if not rule_result:
                    errors.append(f"Validation rule '{rule.type.value}' failed")
                    
            except Exception as error:
                results.append(False)
                errors.append(f"Validation rule '{rule.type.value}' threw error: {error}")
        
        score = sum(results) / len(results) if results else 0.0
        passed = score >= 0.8  # 80% of rules must pass
        
        return {"passed": passed, "score": score, "errors": errors}
    
    def _calculate_similarity(self, a: Any, b: Any) -> float:
        """Calculate similarity between two values."""
        str_a = json.dumps(a, sort_keys=True)
        str_b = json.dumps(b, sort_keys=True)
        
        longer = str_a if len(str_a) > len(str_b) else str_b
        shorter = str_b if len(str_a) > len(str_b) else str_a
        
        if len(longer) == 0:
            return 1.0
        
        edit_distance = self._levenshtein_distance(longer, shorter)
        return (len(longer) - edit_distance) / len(longer)
    
    def _levenshtein_distance(self, str1: str, str2: str) -> int:
        """Calculate Levenshtein distance between two strings."""
        if len(str1) < len(str2):
            return self._levenshtein_distance(str2, str1)
        
        if len(str2) == 0:
            return len(str1)
        
        previous_row = list(range(len(str2) + 1))
        
        for i, c1 in enumerate(str1):
            current_row = [i + 1]
            
            for j, c2 in enumerate(str2):
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            
            previous_row = current_row
        
        return previous_row[-1]
    
    def _validate_schema(self, actual: Any, schema: Any) -> bool:
        """Basic schema validation."""
        try:
            if isinstance(schema, dict) and isinstance(actual, dict):
                for key, expected_type in schema.items():
                    if key not in actual:
                        return False
                    if not isinstance(actual[key], type(expected_type)):
                        return False
            return True
        except Exception:
            return False
    
    def _extract_token_usage(self, output: Any) -> int:
        """Extract token usage from various output formats."""
        if isinstance(output, dict):
            return (
                output.get("tokens_used") or
                output.get("tokensUsed") or
                (output.get("usage", {}).get("total_tokens")) or
                0
            )
        return 0


class TestSuiteRunner:
    """Test Suite Runner - Orchestrates multiple test cases."""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        default_config = {
            "max_concurrency": 5,
            "stop_on_first_failure": False,
            "report_format": "json"
        }
        self.config = {**default_config, **(config or {})}
    
    async def run_suite(
        self,
        test_suite: TestSuite,
        agent_function: Callable
    ) -> Dict[str, Any]:
        """Run a complete test suite."""
        harness = AgentTestHarness(test_suite.agent_name, agent_function)
        results: List[TestResult] = []
        
        if test_suite.configuration.parallel:
            # Run tests in parallel with concurrency limit
            batches = self._create_batches(
                test_suite.test_cases,
                self.config["max_concurrency"]
            )
            
            for batch in batches:
                batch_results = await asyncio.gather(
                    *[harness.run_test(test_case) for test_case in batch],
                    return_exceptions=True
                )
                
                # Filter out exceptions and convert to TestResult
                for i, result in enumerate(batch_results):
                    if isinstance(result, Exception):
                        # Create failed test result for exception
                        test_result = TestResult(
                            test_case_id=batch[i].id,
                            passed=False,
                            performance=TestPerformance(latency=0, tokens_used=0, cost=0),
                            error=str(result),
                            error_type=result.__class__.__name__
                        )
                        results.append(test_result)
                    else:
                        results.append(result)
                
                # Check for early termination
                if (self.config["stop_on_first_failure"] and 
                    any(not r.passed for r in batch_results if isinstance(r, TestResult))):
                    break
        else:
            # Run tests sequentially
            for test_case in test_suite.test_cases:
                try:
                    result = await harness.run_test(test_case)
                    results.append(result)
                    
                    if self.config["stop_on_first_failure"] and not result.passed:
                        break
                except Exception as e:
                    # Create failed test result for exception
                    test_result = TestResult(
                        test_case_id=test_case.id,
                        passed=False,
                        performance=TestPerformance(latency=0, tokens_used=0, cost=0),
                        error=str(e),
                        error_type=e.__class__.__name__
                    )
                    results.append(test_result)
                    
                    if self.config["stop_on_first_failure"]:
                        break
        
        summary = self._calculate_summary(results)
        return {"results": results, "summary": summary}
    
    def _create_batches(self, items: List[Any], batch_size: int) -> List[List[Any]]:
        """Create batches of items."""
        batches = []
        for i in range(0, len(items), batch_size):
            batches.append(items[i:i + batch_size])
        return batches
    
    def _calculate_summary(self, results: List[TestResult]) -> TestSummary:
        """Calculate test summary."""
        total = len(results)
        passed = sum(1 for r in results if r.passed)
        failed = total - passed
        pass_rate = passed / total if total > 0 else 0
        
        avg_latency = (
            sum(r.performance.latency for r in results) / total
            if total > 0 else 0
        )
        total_cost = sum(r.performance.cost for r in results)
        
        return TestSummary(
            total=total,
            passed=passed,
            failed=failed,
            pass_rate=pass_rate,
            avg_latency=avg_latency,
            total_cost=total_cost
        )


class GoldenSetRepository:
    """Golden Set Repository - Manages test data."""
    
    def __init__(self):
        self.test_data: Dict[str, List[TestCase]] = {}
    
    async def load_golden_set(
        self,
        agent_name: AgentName,
        complexity: ComplexityLevel
    ) -> List[TestCase]:
        """Load golden test set for agent and complexity."""
        key = f"{agent_name.value}-{complexity.value}"
        
        if key not in self.test_data:
            test_cases = await self._load_test_cases_from_storage(agent_name, complexity)
            self.test_data[key] = test_cases
        
        return self.test_data[key]
    
    async def _load_test_cases_from_storage(
        self,
        agent_name: AgentName,
        complexity: ComplexityLevel
    ) -> List[TestCase]:
        """Load test cases from storage (placeholder implementation)."""
        # In production, this would load from files or database
        return [
            TestCase(
                id=f"{agent_name.value}-{complexity.value}-001",
                name=f"Sample {complexity.value} test for {agent_name.value}",
                description=f"Test case for {agent_name.value} agent with {complexity.value} complexity",
                complexity=complexity.value,
                category=TestCategory.UNIT,
                input={"test": "data"},
                expected_output={"result": "expected"},
                timeout=30000,
                retries=0,
                metadata=TestMetadata(
                    created_at=datetime.now(),
                    created_by="system",
                    priority=TestPriority.MEDIUM
                )
            )
        ]
    
    async def save_test_case(self, test_case: TestCase) -> None:
        """Save test case to persistent storage."""
        logger.info(f"Saving test case: {test_case.id}")
        # Implementation would save to database/files
    
    async def get_test_cases_by_category(
        self,
        category: TestCategory
    ) -> List[TestCase]:
        """Get test cases by category."""
        all_tests: List[TestCase] = []
        for tests in self.test_data.values():
            all_tests.extend(test for test in tests if test.category == category)
        return all_tests


# Export singleton instances
golden_set_repository = GoldenSetRepository()
test_suite_runner = TestSuiteRunner()