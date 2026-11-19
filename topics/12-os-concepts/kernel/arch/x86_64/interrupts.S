.section .text
.code64

.macro EXCEPTION_NO_ERROR number
.global exception_stub_\number
.type exception_stub_\number, @function
exception_stub_\number:
    pushq $0
    pushq $\number
    jmp exception_common_stub
.endm

.macro EXCEPTION_WITH_ERROR number
.global exception_stub_\number
.type exception_stub_\number, @function
exception_stub_\number:
    pushq $\number
    jmp exception_common_stub
.endm

EXCEPTION_NO_ERROR 0
EXCEPTION_NO_ERROR 1
EXCEPTION_NO_ERROR 2
EXCEPTION_NO_ERROR 3
EXCEPTION_NO_ERROR 4
EXCEPTION_NO_ERROR 5
EXCEPTION_NO_ERROR 6
EXCEPTION_NO_ERROR 7
EXCEPTION_WITH_ERROR 8
EXCEPTION_NO_ERROR 9
EXCEPTION_WITH_ERROR 10
EXCEPTION_WITH_ERROR 11
EXCEPTION_WITH_ERROR 12
EXCEPTION_WITH_ERROR 13
EXCEPTION_WITH_ERROR 14
EXCEPTION_NO_ERROR 15
EXCEPTION_NO_ERROR 16
EXCEPTION_WITH_ERROR 17
EXCEPTION_NO_ERROR 18
EXCEPTION_NO_ERROR 19
EXCEPTION_NO_ERROR 20
EXCEPTION_WITH_ERROR 21
EXCEPTION_NO_ERROR 22
EXCEPTION_NO_ERROR 23
EXCEPTION_NO_ERROR 24
EXCEPTION_NO_ERROR 25
EXCEPTION_NO_ERROR 26
EXCEPTION_NO_ERROR 27
EXCEPTION_NO_ERROR 28
EXCEPTION_WITH_ERROR 29
EXCEPTION_WITH_ERROR 30
EXCEPTION_NO_ERROR 31

.macro IRQ_NO_ERROR number
.global irq_stub_\number
.type irq_stub_\number, @function
irq_stub_\number:
    pushq $0
    pushq $(32 + \number)
    jmp exception_common_stub
.endm

IRQ_NO_ERROR 0
IRQ_NO_ERROR 1
IRQ_NO_ERROR 2
IRQ_NO_ERROR 3
IRQ_NO_ERROR 4
IRQ_NO_ERROR 5
IRQ_NO_ERROR 6
IRQ_NO_ERROR 7
IRQ_NO_ERROR 8
IRQ_NO_ERROR 9
IRQ_NO_ERROR 10
IRQ_NO_ERROR 11
IRQ_NO_ERROR 12
IRQ_NO_ERROR 13
IRQ_NO_ERROR 14
IRQ_NO_ERROR 15

.global exception_default_stub
.type exception_default_stub, @function
exception_default_stub:
    pushq $0
    pushq $255
    jmp exception_common_stub

.global process_first_entry
.type process_first_entry, @function
process_first_entry:
    cli
    movq process_bootstrap_stack_top(%rip), %rsp
    andq $-16, %rsp
    sti
    call process_kernel_thread_start
    ud2

exception_common_stub:
    cld
    pushq %rax
    pushq %rbx
    pushq %rcx
    pushq %rdx
    pushq %rbp
    pushq %rsi
    pushq %rdi
    pushq %r8
    pushq %r9
    pushq %r10
    pushq %r11
    pushq %r12
    pushq %r13
    pushq %r14
    pushq %r15
    movq %rsp, %rdi
    andq $-16, %rsp
    call x86_interrupt_dispatch
    movq %rax, %rsp
    popq %r15
    popq %r14
    popq %r13
    popq %r12
    popq %r11
    popq %r10
    popq %r9
    popq %r8
    popq %rdi
    popq %rsi
    popq %rbp
    popq %rdx
    popq %rcx
    popq %rbx
    popq %rax
    addq $16, %rsp
    iretq

.section .rodata
.align 8
.global exception_stub_table
.type exception_stub_table, @object
exception_stub_table:
    .quad exception_stub_0
    .quad exception_stub_1
    .quad exception_stub_2
    .quad exception_stub_3
    .quad exception_stub_4
    .quad exception_stub_5
    .quad exception_stub_6
    .quad exception_stub_7
    .quad exception_stub_8
    .quad exception_stub_9
    .quad exception_stub_10
    .quad exception_stub_11
    .quad exception_stub_12
    .quad exception_stub_13
    .quad exception_stub_14
    .quad exception_stub_15
    .quad exception_stub_16
    .quad exception_stub_17
    .quad exception_stub_18
    .quad exception_stub_19
    .quad exception_stub_20
    .quad exception_stub_21
    .quad exception_stub_22
    .quad exception_stub_23
    .quad exception_stub_24
    .quad exception_stub_25
    .quad exception_stub_26
    .quad exception_stub_27
    .quad exception_stub_28
    .quad exception_stub_29
    .quad exception_stub_30
    .quad exception_stub_31
.size exception_stub_table, .-exception_stub_table

.align 8
.global irq_stub_table
.type irq_stub_table, @object
irq_stub_table:
    .quad irq_stub_0
    .quad irq_stub_1
    .quad irq_stub_2
    .quad irq_stub_3
    .quad irq_stub_4
    .quad irq_stub_5
    .quad irq_stub_6
    .quad irq_stub_7
    .quad irq_stub_8
    .quad irq_stub_9
    .quad irq_stub_10
    .quad irq_stub_11
    .quad irq_stub_12
    .quad irq_stub_13
    .quad irq_stub_14
    .quad irq_stub_15
.size irq_stub_table, .-irq_stub_table

.section .note.GNU-stack,"",@progbits
